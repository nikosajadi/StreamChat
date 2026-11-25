// ===========================================================================
// App: top-level wiring. Holds the hooks and lays out the screens.
// ---------------------------------------------------------------------------
// Layout:
//   Desktop (>=1024px)  contacts | chat | Live Wire (collapsible)
//   Tablet  (768-1023)  contacts | chat, Live Wire slides in from the right
//   Mobile  (<768px)    contacts OR chat (back button), Live Wire is a
//                       bottom sheet
// ===========================================================================
import { useCallback, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { useChat } from './hooks/useChat';
import { useConnection } from './hooks/useConnection';
import { useTheme } from './hooks/useTheme';
import { useLiveWire } from './hooks/useLiveWire';
import { useMediaQuery } from './hooks/useMediaQuery';
import { RegisterScreen } from './components/auth/RegisterScreen';
import { ContactsPanel } from './components/contacts/ContactsPanel';
import { ChatView } from './components/chat/ChatView';
import { LiveWirePanel } from './components/livewire/LiveWirePanel';
import { LiveWireSheet } from './components/livewire/LiveWireSheet';
import { Masthead } from './components/ui/Masthead';
import { Toasts } from './components/ui/Toasts';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { ConnectionPill } from './components/ui/ConnectionPill';

export function App() {
  const chat = useChat();
  const connection = useConnection();
  const { theme, toggle } = useTheme();
  // Live Wire always listens (so nothing is missed), even while hidden.
  const wire = useLiveWire();

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMobile = useMediaQuery('(max-width: 767px)');
  // Open by default on desktop, closed on smaller screens.
  const [liveWireOpen, setLiveWireOpen] = useState(() => window.matchMedia?.('(min-width: 1024px)').matches ?? true);
  const closeLiveWire = useCallback(() => setLiveWireOpen(false), []);

  const peer = chat.activePeer ? (chat.users[chat.activePeer] ?? null) : null;

  return (
    // reducedMotion="user": framer-motion follows prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      {!chat.me ? (
        <>
          <div className="fixed right-4 top-4 z-10 flex items-center gap-2">
            <ConnectionPill state={connection} />
            <ThemeToggle theme={theme} onToggle={toggle} />
          </div>
          <RegisterScreen onRegister={chat.register} connection={connection} />
        </>
      ) : (
        <div className="flex h-full flex-col">
          {/* Keyboard users can jump straight past the header and contacts. */}
          <a
            href="#conversation"
            className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-sm text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
          >
            Skip to conversation
          </a>
          <Masthead
            connection={connection}
            theme={theme}
            onToggleTheme={toggle}
            liveWireOpen={liveWireOpen}
            onToggleLiveWire={() => setLiveWireOpen((o) => !o)}
          />

          <div className="flex min-h-0 flex-1">
            {/* Contacts: always on md+, on mobile only when no chat is open. */}
            <aside
              className={`${peer ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-hair md:w-[300px] lg:w-[320px]`}
            >
              <ContactsPanel
                me={chat.me}
                connection={connection}
                contacts={chat.contacts}
                conversations={chat.conversations}
                unread={chat.unread}
                typing={chat.typing}
                activePeer={chat.activePeer}
                onOpen={chat.openChat}
              />
            </aside>

            {/* Chat: always on md+, on mobile only when a chat is open. */}
            <main id="conversation" tabIndex={-1} className={`${peer ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col focus:outline-none`}>
              <ChatView
                me={chat.me}
                peer={peer}
                messages={chat.activePeer ? (chat.conversations[chat.activePeer] ?? []) : []}
                peerTyping={!!(chat.activePeer && chat.typing[chat.activePeer])}
                connection={connection}
                onSend={chat.sendMessage}
                onTyping={chat.setTyping}
                onBack={() => chat.openChat(null)}
              />
            </main>

            {/* Live Wire as a third column on desktop. */}
            {isDesktop && liveWireOpen && (
              <aside className="flex w-[360px] shrink-0 flex-col border-l border-hair xl:w-[400px]">
                <LiveWirePanel wire={wire} users={Object.values(chat.users)} me={chat.me} onClose={closeLiveWire} />
              </aside>
            )}
          </div>

          {/* Live Wire as an overlay on tablet (drawer) and mobile (bottom sheet). */}
          <AnimatePresence>
            {!isDesktop && liveWireOpen && (
              <LiveWireSheet variant={isMobile ? 'sheet' : 'drawer'} onClose={closeLiveWire}>
                <LiveWirePanel wire={wire} users={Object.values(chat.users)} me={chat.me} onClose={closeLiveWire} />
              </LiveWireSheet>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Screen reader announcements for incoming messages and typing. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {chat.announcement}
      </p>
      <Toasts />
    </MotionConfig>
  );
}
