// ===========================================================================
// MessageList: the scrolling conversation.
// ---------------------------------------------------------------------------
// - Day separators ("Today", "Yesterday", ...) between calendar days.
// - Consecutive messages from the same person within 5 minutes are grouped:
//   tighter spacing, softer corners, and the time only under the last one.
// - Mine on the right in the accent color, theirs on the left on paper-2.
// - A message that's just 1-3 emoji is shown big, like a sticker.
// - Auto-scrolls to the bottom when you're already near it.
// All text is rendered as plain React text (escaped), never as HTML.
// ===========================================================================
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChatMessage } from '../../lib/socket';
import { dayKey, dayLabel, formatTime } from '../../lib/format';
import { isBigEmoji } from '../../lib/emoji';
import { TypingDots } from './TypingDots';
import { ArtFirstMessage, EmptyState } from '../ui/Illustrations';

const GROUP_GAP = 5 * 60 * 1000;

interface Props {
  me: string;
  peer: string;
  messages: ChatMessage[];
  peerTyping: boolean;
}

export function MessageList({ me, peer, messages, peerTyping }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  // Track whether the user is reading older messages.
  const onScroll = () => {
    const el = scroller.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Jump to the bottom when switching chats.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    nearBottom.current = true;
  }, [peer]);

  // Follow new messages / typing only if already at the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (el && nearBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, peerTyping]);

  if (messages.length === 0 && !peerTyping) {
    return (
      <div className="relative grid flex-1 place-items-center">
        <EmptyState art={<ArtFirstMessage />} title="No messages yet" hint={`Say hello to ${peer}.`} />
      </div>
    );
  }

  return (
    <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <ol className="mx-auto flex max-w-3xl flex-col" aria-label={`Conversation with ${peer}`}>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const mine = m.from === me;
            const newDay = !prev || dayKey(prev.time) !== dayKey(m.time);
            const sameAsPrev = !!prev && !newDay && prev.from === m.from && m.time - prev.time < GROUP_GAP;
            const sameAsNext =
              !!next && dayKey(next.time) === dayKey(m.time) && next.from === m.from && next.time - m.time < GROUP_GAP;
            const big = isBigEmoji(m.text);

            // Corner shaping: the side facing the group gets a small radius.
            const corners = mine
              ? `${sameAsPrev ? 'rounded-tr-md' : ''} ${sameAsNext ? 'rounded-br-md' : ''}`
              : `${sameAsPrev ? 'rounded-tl-md' : ''} ${sameAsNext ? 'rounded-bl-md' : ''}`;

            return (
              <Fragment key={m.id}>
                {newDay && (
                  <li className="my-5 flex items-center gap-4" aria-label={dayLabel(m.time)}>
                    <span className="h-px flex-1 bg-ink/10" />
                    <span className="label">{dayLabel(m.time)}</span>
                    <span className="h-px flex-1 bg-ink/10" />
                  </li>
                )}
                <motion.li
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
                  className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${sameAsPrev ? 'mt-0.5' : 'mt-3'}`}
                >
                  <span className="sr-only">{mine ? 'You' : m.from} said:</span>
                  <div
                    className={
                      big
                        ? 'px-1 text-[44px] leading-tight'
                        : `max-w-[min(78%,34rem)] whitespace-pre-wrap break-words rounded-bubble px-4 py-2.5 text-[15px] leading-relaxed ${corners} ${
                            mine ? 'bg-accent-deep text-white' : 'bg-paper-2 text-ink'
                          }`
                    }
                  >
                    {m.text}
                  </div>
                  {!sameAsNext && (
                    <time dateTime={new Date(m.time).toISOString()} className="mt-1 px-1 font-mono text-[10.5px] text-ink-muted">
                      {formatTime(m.time)}
                      {mine && !m.delivered ? ' · stored' : ''}
                    </time>
                  )}
                </motion.li>
              </Fragment>
            );
          })}
          {peerTyping && (
            <li key="typing" className="mt-3">
              <TypingDots />
            </li>
          )}
        </AnimatePresence>
      </ol>
    </div>
  );
}
