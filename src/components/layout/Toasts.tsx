import { useToastStore, type ToastKind } from '../../store/toast';
import { focusRing } from '../common/styles';

const KIND_CLASS: Record<ToastKind, string> = {
  info: 'border-accent/60',
  warn: 'border-effYellow',
  error: 'border-effRed',
};

const KIND_LABEL: Record<ToastKind, string> = {
  info: 'お知らせ',
  warn: '注意',
  error: 'エラー',
};

/** 画面下のお知らせ */
export default function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-3"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-md min-w-0 items-start gap-2 rounded-md border-l-4 border border-border bg-surface px-3 py-2 text-sm shadow-lg ${KIND_CLASS[t.kind]}`}
        >
          <span className="sr-only">{KIND_LABEL[t.kind]}: </span>
          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="閉じる"
            className={`shrink-0 rounded px-1 text-muted hover:text-text ${focusRing}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
