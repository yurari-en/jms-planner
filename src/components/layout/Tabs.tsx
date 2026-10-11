import { useRef, type KeyboardEvent } from 'react';
import { useUiStore } from '../../store/ui';
import { focusRing } from '../common/styles';
import { TAB_DEFS, panelId, tabId } from './tabDefs';

/** 3つのタブ。矢印キー/Home/End で移動。選択は location.hash と同期(ui ストア) */
export default function Tabs() {
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = TAB_DEFS.findIndex((t) => t.id === tab);
    let next = cur;
    if (e.key === 'ArrowRight') next = (cur + 1) % TAB_DEFS.length;
    else if (e.key === 'ArrowLeft') next = (cur - 1 + TAB_DEFS.length) % TAB_DEFS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TAB_DEFS.length - 1;
    else return;
    e.preventDefault();
    const def = TAB_DEFS[next];
    if (!def) return;
    setTab(def.id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="画面の切り替え"
      onKeyDown={onKeyDown}
      className="flex min-w-0 gap-1 border-b border-border"
    >
      {TAB_DEFS.map((t, i) => {
        const selected = t.id === tab;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(t.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`-mb-px min-w-0 flex-1 truncate rounded-t-md border-b-2 px-2 py-2 text-sm sm:flex-none sm:px-4 ${focusRing} ${
              selected
                ? 'border-accent font-bold text-text'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
