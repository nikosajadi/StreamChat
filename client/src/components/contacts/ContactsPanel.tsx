// ===========================================================================
// ContactsPanel: left column. My profile, a search box and the contact list
// (online first, then offline with "last seen").
// ===========================================================================
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import type { ChatMessage, PublicUser } from '../../lib/socket';
import type { ConnectionState } from '../../hooks/useConnection';
import { presenceText } from '../../lib/format';
import { useNow } from '../../hooks/useNow';
import { Avatar } from '../ui/Avatar';
import { ArtContacts, ArtNoResults, EmptyState } from '../ui/Illustrations';

interface Props {
  me: string;
  connection: ConnectionState;
  contacts: PublicUser[];
  conversations: Record<string, ChatMessage[]>;
  unread: Record<string, number>;
  typing: Record<string, boolean>;
  activePeer: string | null;
  onOpen: (name: string) => void;
}

export function ContactsPanel(props: Props) {
  const { me, connection, contacts, conversations, unread, typing, activePeer, onOpen } = props;
  const [query, setQuery] = useState('');
  const now = useNow();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? contacts.filter((c) => c.name.toLowerCase().includes(q)) : contacts;
  }, [contacts, query]);

  const onlineCount = contacts.filter((c) => c.online).length;

  return (
    <nav aria-label="Contacts" className="flex h-full min-h-0 flex-col">
      {/* ---- my profile ---- */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <Avatar name={me} size={44} online={connection === 'connected'} />
        <div className="min-w-0">
          <p className="truncate font-display text-xl leading-tight text-ink">{me}</p>
          <p className="text-xs text-ink-muted">That's you</p>
        </div>
      </div>

      {/* ---- search ---- */}
      <div className="px-5">
        <label className="relative block">
          <span className="sr-only">Search contacts</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full rounded-full border border-hair bg-paper-2/60 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-5 flex items-baseline justify-between border-b border-hair px-5 pb-2">
        <h2 className="label">Contacts</h2>
        <span className="font-mono text-[11px] text-ink-muted">
          {onlineCount}/{contacts.length} online
        </span>
      </div>

      {/* ---- list ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {contacts.length === 0 ? (
          <EmptyState art={<ArtContacts />} title="No one else here yet" hint="Open another tab or send the link to a friend." />
        ) : filtered.length === 0 ? (
          <EmptyState art={<ArtNoResults />} title="No matches" hint={`Nobody called "${query.trim()}".`} />
        ) : (
          <ul className="flex flex-col gap-0.5">
            <AnimatePresence initial={false}>
              {filtered.map((c) => {
                const last = conversations[c.name]?.at(-1);
                const isTyping = !!typing[c.name];
                const count = unread[c.name] ?? 0;
                const active = c.name === activePeer;
                // Sub-line priority: typing… > last message > presence.
                const sub = isTyping
                  ? 'typing…'
                  : last
                    ? `${last.from === me ? 'You: ' : ''}${last.text}`
                    : presenceText(c, now);
                return (
                  <motion.li
                    key={c.name}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(c.name)}
                      aria-current={active ? 'true' : undefined}
                      aria-label={`${c.name}, ${c.online ? 'online' : 'offline'}${count ? `, ${count} unread` : ''}${isTyping ? ', typing' : ''}`}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-paper-3' : 'hover:bg-paper-2'
                      }`}
                    >
                      {/* offline people: faded avatar only, text keeps full AA contrast */}
                      <Avatar name={c.name} size={40} online={c.online} className={c.online ? '' : 'opacity-60 saturate-50'} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[17px] leading-tight text-ink">{c.name}</span>
                        <span className={`block truncate text-[13px] ${isTyping ? 'italic text-accent-ink' : 'text-ink-muted'}`}>{sub}</span>
                      </span>
                      {count > 0 && (
                        <motion.span
                          key={count}
                          initial={{ scale: 0.6 }}
                          animate={{ scale: 1 }}
                          className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-deep px-1.5 font-mono text-[11px] font-medium text-white"
                          aria-hidden="true"
                        >
                          {count}
                        </motion.span>
                      )}
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </nav>
  );
}
