// ===========================================================================
// EmojiPicker: the panel that opens from the smiley button in the composer.
// Kept from the old client. Clicking an emoji calls onPick; the panel stays
// open so you can pick several. Escape or clicking outside closes it.
// ===========================================================================
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { EMOJI_GROUPS } from '../../lib/emoji';

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
  /** the toggle button, so clicking it doesn't count as "outside" */
  anchor: React.RefObject<HTMLElement | null>;
}

export function EmojiPicker({ onPick, onClose, anchor }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchor]);

  return (
    <motion.div
      ref={panel}
      role="dialog"
      aria-label="Emoji picker"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-[min(340px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-hair bg-paper px-3 pb-3 shadow-card"
    >
      {EMOJI_GROUPS.map(([group, list]) => (
        <section key={group} aria-label={group}>
          <h3 className="label sticky top-0 bg-paper pb-1 pt-3">{group}</h3>
          <div className="grid grid-cols-8 gap-0.5">
            {list.map((e) => (
              <button
                key={e}
                type="button"
                // keep focus in the textarea so the cursor position survives
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => onPick(e)}
                className="grid h-9 place-items-center rounded-lg text-[22px] transition-transform hover:scale-110 hover:bg-paper-2"
                aria-label={e}
              >
                {e}
              </button>
            ))}
          </div>
        </section>
      ))}
    </motion.div>
  );
}
