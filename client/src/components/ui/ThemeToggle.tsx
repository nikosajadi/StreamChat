// ===========================================================================
// ThemeToggle: switches between "Paper" and "Night ink".
// ===========================================================================
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import type { Theme } from '../../hooks/useTheme';

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const next = theme === 'paper' ? 'Night ink' : 'Paper';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="icon-btn relative overflow-hidden"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 10, opacity: 0, rotate: -30 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -10, opacity: 0, rotate: 30 }}
          transition={{ duration: 0.18 }}
          className="grid place-items-center"
        >
          {theme === 'paper' ? <Moon size={17} /> : <Sun size={17} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
