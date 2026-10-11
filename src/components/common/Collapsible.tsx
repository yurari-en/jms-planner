import { useId, type ReactNode } from 'react';
import { useUiStore } from '../../store/ui';
import { focusRing } from './styles';

export interface CollapsibleProps {
  /** 折りたたみ状態の保存キー(ui ストアの collapsed[id]) */
  id: string;
  title: ReactNode;
  children: ReactNode;
  /** 保存値が無いときに閉じておく */
  defaultCollapsed?: boolean;
  /** 見出しの右側に出すもの */
  extra?: ReactNode;
  className?: string;
}

/** 開閉できる区画。開閉状態は localStorage(ui)に保存される */
export default function Collapsible({
  id,
  title,
  children,
  defaultCollapsed = false,
  extra,
  className = '',
}: CollapsibleProps) {
  const stored = useUiStore((s) => s.collapsed[id]);
  const setCollapsed = useUiStore((s) => s.setCollapsed);
  const collapsed = stored ?? defaultCollapsed;
  const bodyId = useId();
  return (
    <section className={`min-w-0 rounded-lg border border-border bg-surface ${className}`}>
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={() => setCollapsed(id, !collapsed)}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded text-left text-sm font-bold ${focusRing}`}
        >
          <span
            aria-hidden="true"
            className={`inline-block text-xs text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`}
          >
            ▶
          </span>
          <span className="min-w-0 truncate">{title}</span>
        </button>
        {extra}
      </div>
      <div id={bodyId} hidden={collapsed} className="min-w-0 border-t border-border px-3 py-3">
        {children}
      </div>
    </section>
  );
}
