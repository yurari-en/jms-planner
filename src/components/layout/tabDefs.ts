import type { TabId } from '../../store/schemas';

export const TAB_DEFS: { id: TabId; label: string }[] = [
  { id: 'plan', label: '強化順序' },
  { id: 'input', label: 'キャラ・装備入力' },
  { id: 'settings', label: '設定' },
];

/** タブボタンの id */
export const tabId = (id: TabId) => `tab-${id}`;
/** タブパネルの id */
export const panelId = (id: TabId) => `panel-${id}`;
