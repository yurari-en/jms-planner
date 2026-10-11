// 画面の状態(localStorage `jmsplanner:v1:ui`。即時保存)。DESIGN.md §4.2 / §10。
// index.html のテーマ初期化スクリプトが `JSON.parse(raw).theme` を読むので、平らな形で保存する。
import { create } from 'zustand';
import { loadValidated, writeStorage } from './persist';
import { TABS, uiStateSchema, type TabId, type Theme, type UiStateFile } from './schemas';

export const UI_KEY = 'jmsplanner:v1:ui';

export interface UiState {
  theme: Theme;
  tab: TabId;
  collapsed: Record<string, boolean>;
  selectedSlot: string | null;
  firstRunDismissed: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** location.hash も #plan / #input / #settings に書き換える */
  setTab: (tab: TabId) => void;
  toggleCollapsed: (id: string) => void;
  setCollapsed: (id: string, collapsed: boolean) => void;
  setSelectedSlot: (slot: string | null) => void;
  dismissFirstRun: () => void;
}

function hasDocument(): boolean {
  return typeof document !== 'undefined' && !!document.documentElement;
}

function systemTheme(): Theme {
  if (hasDocument() && document.documentElement.classList.contains('dark')) return 'dark';
  try {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    )
      return 'dark';
  } catch {
    // 何もしない
  }
  return 'light';
}

export function tabFromHash(hash: string): TabId | null {
  const h = hash.replace(/^#/, '');
  return (TABS as readonly string[]).includes(h) ? (h as TabId) : null;
}

function currentHash(): string {
  try {
    return typeof location !== 'undefined' ? location.hash : '';
  } catch {
    return '';
  }
}

function applyThemeClass(theme: Theme): void {
  if (hasDocument()) document.documentElement.classList.toggle('dark', theme === 'dark');
}

function writeHash(tab: TabId): void {
  try {
    if (typeof location !== 'undefined' && location.hash !== `#${tab}`) location.hash = tab;
  } catch {
    // 何もしない
  }
}

function initialState(): UiStateFile {
  const loaded = loadValidated(UI_KEY, uiStateSchema, () => ({
    version: 1 as const,
    theme: systemTheme(),
    tab: 'plan' as const,
    collapsed: {},
    selectedSlot: null,
    firstRunDismissed: false,
  }));
  const fromHash = tabFromHash(currentHash());
  return fromHash ? { ...loaded.value, tab: fromHash } : loaded.value;
}

const init = initialState();
applyThemeClass(init.theme);

export const useUiStore = create<UiState>()((set, get) => ({
  theme: init.theme,
  tab: init.tab,
  collapsed: init.collapsed,
  selectedSlot: init.selectedSlot ?? null,
  firstRunDismissed: init.firstRunDismissed,

  setTheme: (theme) => {
    applyThemeClass(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setTab: (tab) => {
    if (get().tab !== tab) set({ tab });
    writeHash(tab);
  },
  toggleCollapsed: (id) => set((s) => ({ collapsed: { ...s.collapsed, [id]: !s.collapsed[id] } })),
  setCollapsed: (id, collapsed) => set((s) => ({ collapsed: { ...s.collapsed, [id]: collapsed } })),
  setSelectedSlot: (slot) => set({ selectedSlot: slot }),
  dismissFirstRun: () => set({ firstRunDismissed: true }),
}));

// 変更のたびに即時保存
useUiStore.subscribe((s) => {
  const file: UiStateFile = {
    version: 1,
    theme: s.theme,
    tab: s.tab,
    collapsed: s.collapsed,
    selectedSlot: s.selectedSlot,
    firstRunDismissed: s.firstRunDismissed,
  };
  writeStorage(UI_KEY, JSON.stringify(file));
});

// 戻る/進む・手入力の hash 変更に追従
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('hashchange', () => {
    const tab = tabFromHash(currentHash());
    if (tab && useUiStore.getState().tab !== tab) useUiStore.setState({ tab });
  });
}
