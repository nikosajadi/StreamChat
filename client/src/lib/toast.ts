// ===========================================================================
// lib/toast.ts: a tiny toast store that lives outside React.
// ---------------------------------------------------------------------------
// Anything (hooks, socket handlers) can call toast("...") without needing
// a context. The <Toasts> component subscribes with useSyncExternalStore.
// ===========================================================================

export type ToastKind = 'error' | 'info';
export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

let toasts: Toast[] = [];
let seq = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Show a small toast for ~4 seconds. */
export function toast(text: string, kind: ToastKind = 'error') {
  const t: Toast = { id: seq++, kind, text };
  toasts = [...toasts, t].slice(-4); // never more than 4 on screen
  emit();
  setTimeout(() => dismissToast(t.id), 4200);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toastStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => toasts,
};
