// 強化順序の計算結果(保存しない)。DESIGN.md §7.3。
// 入力・設定の変更から 300ms デバウンスで Worker に投げる。古い結果は捨てる(連番で判定)。
import { create } from 'zustand';
import type { MasterData } from '../data/types';
import type { FlameRankResult, PlanResult, PlanWarning } from '../domain/planTypes';
import type { PlannerClient } from '../worker/client';
import { selectActiveCharacter, useCharactersStore } from './characters';
import { useSettingsStore } from './settings';

export type PlanStatus = 'idle' | 'computing' | 'ready' | 'error';

export interface PlanState {
  status: PlanStatus;
  plan: PlanResult | null;
  flames: FlameRankResult | null;
  /** 入力チェック(validate)の結果 */
  warnings: PlanWarning[];
  error: string | null;
  /** 最後に計算を投げた入力のキー(同じ入力なら再計算しない) */
  lastInputKey: string;
  /** Worker を作って(1回だけ)マスタを渡し、再計算を予約する */
  attachData: (data: MasterData) => Promise<void>;
  /** 300ms デバウンスで再計算 */
  requestRecompute: () => void;
  /** デバウンスを待たずに再計算(force なら同じ入力でも計算する) */
  recomputeNow: (force?: boolean) => Promise<void>;
}

export const RECOMPUTE_DEBOUNCE_MS = 300;

let client: PlannerClient | null = null;
let clientReady: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const usePlanStore = create<PlanState>()((set, get) => ({
  status: 'idle',
  plan: null,
  flames: null,
  warnings: [],
  error: null,
  lastInputKey: '',

  attachData: async (data) => {
    clientReady = (async () => {
      if (!client) {
        const mod = await import('../worker/client');
        client = mod.createPlannerClient();
      }
      await client.setMasterData(data);
    })();
    try {
      await clientReady;
      set({ lastInputKey: '' });
      get().requestRecompute();
    } catch (e) {
      set({ status: 'error', error: `計算エンジンの準備に失敗しました: ${errorMessage(e)}` });
    }
  },

  requestRecompute: () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void get().recomputeNow();
    }, RECOMPUTE_DEBOUNCE_MS);
  },

  recomputeNow: async (force = false) => {
    const ch = selectActiveCharacter(useCharactersStore.getState());
    const settings = useSettingsStore.getState().settings;
    if (!client || !clientReady || !ch || !settings) {
      set({
        status: 'idle',
        plan: null,
        flames: null,
        warnings: [],
        error: null,
        lastInputKey: '',
      });
      return;
    }
    const key = JSON.stringify([ch, settings]);
    if (!force && key === get().lastInputKey && get().status !== 'error') return;
    const my = ++seq;
    set({ status: 'computing', lastInputKey: key, error: null });
    try {
      await clientReady;
      const c = client;
      const [plan, flames, warnings] = await Promise.all([
        c.buildPlan(ch, settings),
        c.rankFlames(ch, settings),
        c.validate(ch, settings),
      ]);
      if (my !== seq) return; // 古い結果
      set({ status: 'ready', plan, flames, warnings, error: null });
    } catch (e) {
      if (my !== seq) return;
      set({ status: 'error', error: `計算に失敗しました: ${errorMessage(e)}`, lastInputKey: '' });
    }
  },
}));

let syncStarted = false;

/**
 * 選択中のキャラ・設定の変更を監視して再計算を予約する。main.tsx から1回だけ呼ぶ。
 * 戻り値で監視を止められる。
 */
export function startPlanSync(): () => void {
  if (syncStarted) return () => {};
  syncStarted = true;
  let lastCh = selectActiveCharacter(useCharactersStore.getState());
  let lastSettings = useSettingsStore.getState().settings;
  const unsubChars = useCharactersStore.subscribe((s) => {
    const ch = selectActiveCharacter(s);
    if (ch !== lastCh) {
      lastCh = ch;
      usePlanStore.getState().requestRecompute();
    }
  });
  const unsubSettings = useSettingsStore.subscribe((s) => {
    if (s.settings !== lastSettings) {
      lastSettings = s.settings;
      usePlanStore.getState().requestRecompute();
    }
  });
  return () => {
    unsubChars();
    unsubSettings();
    syncStarted = false;
  };
}
