// ===========================================================================
// Composer: the message box at the bottom of a chat.
// ---------------------------------------------------------------------------
// - Enter sends, Shift+Enter adds a new line.
// - The textarea grows with the text (up to ~6 lines).
// - Send is disabled while empty or while the socket is down.
// - Typing events, same rules as before: "start" once when you begin,
//   "stop" after 1.5s of no typing, on blur, and on send (useChat.setTyping
//   makes sure each change is only sent once).
// - Smiley button opens the emoji picker; emoji go in at the cursor.
// ===========================================================================
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SendHorizontal, Smile } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';

interface Props {
  peer: string;
  disabled: boolean;
  onSend: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
}

const MAX_HEIGHT = 160; // px, about 6 lines

export function Composer({ peer, disabled, onSend, onTyping }: Props) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const emojiBtn = useRef<HTMLButtonElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fresh, empty box when switching chats.
  useEffect(() => {
    setText('');
    setEmojiOpen(false);
    box.current?.focus();
  }, [peer]);

  // Grow / shrink the textarea to fit its content.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    // Only show a scrollbar once it hits the max height.
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [text]);

  useEffect(() => () => clearTimeout(idle.current), []);

  // Called on every change: announce typing, and schedule the "stop".
  const change = useCallback(
    (value: string) => {
      setText(value);
      clearTimeout(idle.current);
      if (value.trim()) {
        onTyping(true);
        idle.current = setTimeout(() => onTyping(false), 1500);
      } else {
        onTyping(false);
      }
    },
    [onTyping],
  );

  const send = () => {
    const clean = text.trim();
    if (!clean || disabled) return;
    clearTimeout(idle.current);
    onSend(clean); // also sends "stopped typing"
    setText('');
    setEmojiOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = send, Shift+Enter = newline. Skip while an IME is composing.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  // Put an emoji where the cursor is (or replace the selection).
  const insertEmoji = (emoji: string) => {
    const el = box.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    change(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const closeEmoji = useCallback(() => setEmojiOpen(false), []);
  const empty = !text.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="relative border-t border-hair bg-paper/85 px-3 py-3 backdrop-blur-sm sm:px-6"
    >
      <div className="relative mx-auto flex max-w-3xl items-end gap-2">
        <div className="relative">
          <button
            ref={emojiBtn}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEmojiOpen((o) => !o)}
            disabled={disabled}
            className={`icon-btn h-11 w-11 ${emojiOpen ? 'bg-paper-3 text-accent' : ''}`}
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
          >
            <Smile size={20} />
          </button>
          <AnimatePresence>
            {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={closeEmoji} anchor={emojiBtn} />}
          </AnimatePresence>
        </div>

        <label className="min-w-0 flex-1">
          <span className="sr-only">Message to {peer}</span>
          <textarea
            ref={box}
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(e) => change(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              clearTimeout(idle.current);
              onTyping(false);
            }}
            maxLength={2000}
            placeholder={disabled ? 'Waiting for the connection…' : `Write to ${peer}…`}
            className="block w-full resize-none rounded-3xl border border-hair bg-paper-2/70 px-4 py-[11px] text-[15px] leading-snug text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none disabled:opacity-60"
          />
        </label>

        <button
          type="submit"
          disabled={empty || disabled}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-deep text-white transition-all hover:brightness-110 disabled:bg-ink/15 disabled:text-ink-muted"
          aria-label="Send message"
        >
          <SendHorizontal size={18} />
        </button>
      </div>
      <p className="sr-only">Press Enter to send, Shift plus Enter for a new line.</p>
    </form>
  );
}
