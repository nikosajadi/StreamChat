// ===========================================================================
// LiveWireSheet: Live Wire as an overlay on smaller screens.
//   Tablet (768-1023px): slides in from the right.
//   Mobile (<768px):     slides up from the bottom as a sheet.
// It's a modal dialog: focus moves into it, Escape or the backdrop closes
// it, and focus goes back to where it was.
// ===========================================================================
import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  variant: 'drawer' | 'sheet';
  onClose: () => void;
  children: ReactNode;
}

export function LiveWireSheet({ variant, onClose, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, [onClose]);

  const sheet = variant === 'sheet';

  return (
    <div className="fixed inset-0 z-40">
      {/* backdrop */}
      <motion.button
        type="button"
        aria-label="Close Live Wire"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/25 backdrop-blur-[1px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Live Wire"
        tabIndex={-1}
        className={
          sheet
            ? 'absolute inset-x-0 bottom-0 flex h-[82vh] flex-col overflow-hidden rounded-t-card border-t border-hair bg-paper shadow-card focus:outline-none'
            : 'absolute bottom-0 right-0 top-0 flex w-[min(400px,92vw)] flex-col overflow-hidden border-l border-hair bg-paper shadow-card focus:outline-none'
        }
        initial={sheet ? { y: '100%' } : { x: '100%' }}
        animate={sheet ? { y: 0 } : { x: 0 }}
        exit={sheet ? { y: '100%' } : { x: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      >
        {sheet && <span className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-ink/20" aria-hidden="true" />}
        <div className="min-h-0 flex-1">{children}</div>
      </motion.div>
    </div>
  );
}
