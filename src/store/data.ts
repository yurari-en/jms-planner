// 静的マスタの読み込み状態(保存しない)。DESIGN.md §4.1。
import { create } from 'zustand';
import { buildIndexes, type MasterIndexes } from '../data/indexes';
import { loadMasterData } from '../data/loader';
import type { MasterData } from '../data/types';
import { usePlanStore } from './plan';
import { useSettingsStore } from './settings';

export type DataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DataState {
  status: DataStatus;
  data: MasterData | null;
  idx: MasterIndexes | null;
  /** 読み込み時の注意(manifest 無し・シード版の確率表 など)。日本語 */
  warnings: string[];
  error: string | null;
  /** マスタを読み込み、索引を作り、設定の既定値を確定し、計算エンジンに渡す */
  load: () => Promise<void>;
}

export const useDataStore = create<DataState>()((set, get) => ({
  status: 'idle',
  data: null,
  idx: null,
  warnings: [],
  error: null,

  load: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });
    try {
      const { data, warnings } = await loadMasterData(import.meta.env.BASE_URL);
      const idx = buildIndexes(data);
      useSettingsStore.getState().initDefaults(data.cubes);
      set({ status: 'ready', data, idx, warnings, error: null });
      void usePlanStore.getState().attachData(data);
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
}));
