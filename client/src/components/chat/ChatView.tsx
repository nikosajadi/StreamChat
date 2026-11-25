// ===========================================================================
// ChatView: center column. Header (who you're talking to + status), the
// message list over the background art, a banner when disconnected, and
// the composer.
// ===========================================================================
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CloudOff } from 'lucide-react';
import type { ChatMessage, PublicUser } from '../../lib/socket';
import type { ConnectionState } from '../../hooks/useConnection';
import { presenceText } from '../../lib/format';
import { useNow } from '../../hooks/useNow';
import { Avatar } from '../ui/Avatar';
import { ChatBackground } from '../ui/ChatBackground';
import { ArtConversation, EmptyState } from '../ui/Illustrations';
import { MessageList } from './MessageList';
import { Composer } from './Composer';

interface Props {
  me: string;
  peer: PublicUser | null;
  messages: ChatMessage[];
  peerTyping: boolean;
  connection: ConnectionState;
  onSend: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  /** mobile only: go back to the contact list */
  onBack: () => void;
}

export function ChatView({ me, peer, messages, peerTyping, connection, onSend, onTyping, onBack }: Props) {
  const now = useNow();
  const down = connection !== 'connected';

  return (
    <section aria-label={peer ? `Chat with ${peer.name}` : 'Chat'} className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <ChatBackground />

      {!peer ? (
        <div className="relative grid flex-1 place-items-center">
          <EmptyState art={<ArtConversation />} title="Pick someone to talk to" hint="Your conversations will show up here." />
        </div>
      ) : (
        <>
          {/* ---- header ---- */}
          <header className="relative flex items-center gap-3 border-b border-hair bg-paper/80 px-3 py-3 backdrop-blur-sm sm:px-6">
            <button type="button" onClick={onBack} className="icon-btn md:hidden" aria-label="Back to contacts">
              <ArrowLeft size={18} />
            </button>
            <Avatar name={peer.name} size={40} online={peer.online} />
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl leading-tight text-ink">{peer.name}</h2>
              <p className={`text-[13px] ${peerTyping ? 'italic text-accent-ink' : peer.online ? 'text-online' : 'text-ink-muted'}`}>
                {peerTyping ? 'typing…' : presenceText(peer, now)}
              </p>
            </div>
          </header>

          {/* ---- calm banner while the socket is down ---- */}
          <AnimatePresence>
            {down && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="relative overflow-hidden border-b border-hair bg-paper-2/90"
              >
                <p className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-ink-muted">
                  <CloudOff size={15} aria-hidden="true" />
                  {connection === 'offline'
                    ? "You're offline. Messages will work again once you're back."
                    : 'Lost the connection for a moment. Trying again…'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <MessageList me={me} peer={peer.name} messages={messages} peerTyping={peerTyping} />
          <Composer peer={peer.name} disabled={down} onSend={onSend} onTyping={onTyping} />
        </>
      )}
    </section>
  );
}
