// ===========================================================================
// Toasts: small notes in the corner, mostly for errors from acks
// (e.g. "This name is already taken."). Fed by lib/toast.ts.
// ===========================================================================
import { useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { dismissToast, toastStore } from '../../lib/toast';

export function Toasts() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.get);

  return (
    // role=status + aria-live: screen readers read new toasts politely.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pr-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border border-hair bg-paper-2 px-4 py-3 text-sm shadow-card ${
              t.kind === 'error' ? 'border-l-[3px] border-l-danger' : 'border-l-[3px] border-l-indigo'
            }`}
          >
            <span className="flex-1 text-ink">{t.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="-mr-1 rounded-full p-0.5 text-ink-muted hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
