// 画面下のお知らせ(トースト)。6秒で自動的に消える。
import { create } from 'zustand';

export type ToastKind = 'info' | 'warn' | 'error';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

export interface ToastState {
  toasts: Toast[];
  /** 戻り値はトーストの id */
  push: (message: string, kind?: ToastKind) => number;
  dismiss: (id: number) => void;
}

export const TOAST_TIMEOUT_MS = 6000;

let seq = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (message, kind = 'info') => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => get().dismiss(id), TOAST_TIMEOUT_MS);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** React の外から使う短縮形 */
export function toast(message: string, kind: ToastKind = 'info'): number {
  return useToastStore.getState().push(message, kind);
}
