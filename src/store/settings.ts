// 強化オプション(設定)の保存(localStorage `jmsplanner:v1:settings`)。DESIGN.md §4.2 / §5.3。
// 既定値の一部(キューブ価格・メル換算)は cubes.json 由来なので、マスタ読み込み後の initDefaults で確定する。
// それまでは settings = null。保存は 300ms デバウンス。
import { create } from 'zustand';
import type { CubesMaster } from '../data/types';
import { defaultSettings, type PlannerSettings } from '../domain/settings';
import { backupRaw, createDebouncedStorage, safeJsonParse } from './persist';
import { isRecord, migrateSettings } from './schemas';

export const SETTINGS_KEY = 'jmsplanner:v1:settings';

export interface SettingsState {
  settings: PlannerSettings | null;
  /** initDefaults 済み */
  initialized: boolean;
  /** cubes.json から作った既定値(initDefaults 後) */
  defaults: PlannerSettings | null;
  /** 保存値を読み込んで既定値と合わせる(マスタ読み込み後に1回) */
  initDefaults: (cubes: CubesMaster) => void;
  /** トップレベルのキーを部分的に置き換える(ネストしたオブジェクトは丸ごと置き換え) */
  update: (patch: Partial<PlannerSettings>) => void;
  /** updater は新しい設定を返す(undefined なら変更なし) */
  set: (updater: (s: PlannerSettings) => PlannerSettings | void) => void;
  /** 1項目だけ既定値に戻す */
  resetKey: (key: keyof PlannerSettings) => void;
  resetAll: () => void;
}

export const settingsDebouncedStorage = createDebouncedStorage(300);

function save(settings: PlannerSettings | null): void {
  if (settings) settingsDebouncedStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: null,
  initialized: false,
  defaults: null,

  initDefaults: (cubes) => {
    const defaults = defaultSettings(cubes);
    const raw = settingsDebouncedStorage.getItem(SETTINGS_KEY);
    let settings: PlannerSettings = clone(defaults);
    if (raw !== null) {
      const parsed = safeJsonParse(raw);
      if (parsed.ok && isRecord(parsed.value) && parsed.value.version === 1) {
        settings = migrateSettings(parsed.value, defaults);
      } else {
        backupRaw(SETTINGS_KEY, raw, true);
      }
    }
    set({ settings, defaults, initialized: true });
    save(settings);
  },

  update: (patch) => {
    const cur = get().settings;
    if (!cur) return;
    const next = { ...cur, ...patch, version: 1 as const };
    set({ settings: next });
    save(next);
  },

  set: (updater) => {
    const cur = get().settings;
    if (!cur) return;
    const next = updater(cur);
    if (!next || next === cur) return;
    set({ settings: next });
    save(next);
  },

  resetKey: (key) => {
    const { settings, defaults } = get();
    if (!settings || !defaults) return;
    const next = { ...settings, [key]: clone(defaults[key]) } as PlannerSettings;
    set({ settings: next });
    save(next);
  },

  resetAll: () => {
    const { defaults } = get();
    if (!defaults) return;
    const next = clone(defaults);
    set({ settings: next });
    save(next);
  },
}));
