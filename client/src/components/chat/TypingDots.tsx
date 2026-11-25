// TypingDots: the three bouncing dots shown in the conversation while the
// other person is typing. Decorative; the live region announces it.
import { motion } from 'framer-motion';

export function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex w-fit items-center gap-1 rounded-bubble rounded-bl-md bg-paper-2 px-4 py-3"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-blink rounded-full bg-ink-muted" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </motion.div>
  );
}
