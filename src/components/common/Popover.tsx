import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** 位置の基準にする要素 */
  anchorRef: RefObject<HTMLElement>;
  children: ReactNode;
  /** 基準要素の左揃え(start)/右揃え(end) */
  align?: 'start' | 'end';
  className?: string;
  /** 読み上げ用のラベル */
  label?: string;
  role?: 'dialog' | 'menu';
}

const MARGIN = 8;

/** 基準要素の下に出す浮きパネル。画面内に収まるよう位置を調整。外側クリック・Esc で閉じる */
export default function Popover({
  open,
  onClose,
  anchorRef,
  children,
  align = 'start',
  className = '',
  label,
  role = 'dialog',
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const a = anchor.getBoundingClientRect();
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = align === 'end' ? a.right - w : a.left;
      left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
      let top = a.bottom + 4;
      if (top + h > vh - MARGIN && a.top - h - 4 >= MARGIN) top = a.top - h - 4;
      top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        anchorRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, anchorRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-label={label}
      style={{
        position: 'fixed',
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
      }}
      className={`z-40 max-h-[80vh] overflow-y-auto rounded-md border border-border bg-surface p-2 text-sm shadow-lg ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
