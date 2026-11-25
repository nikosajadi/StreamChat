// ===========================================================================
// useChat: everything about users, messages, typing and unread counts.
// ---------------------------------------------------------------------------
// Socket flow (same as the old public/app.js):
//
//   1. register(name) -> server ack gives me, token, users, history.
//      The token is saved per name and sent on every later register.
//   2. "user:new" / "user:online" / "user:offline" update the contact list.
//   3. sendMessage() emits "message:send"; the bubble is added only when the
//      server's ack comes back, so what you see is what was stored.
//   4. "message:new" adds an incoming message (+1 unread if that chat
//      isn't open).
//   5. setTyping(true/false) emits "typing" once per change. Incoming
//      "typing" shows the indicator; it's cleared on stop, on a message from
//      that person, on "user:offline", or after a 5s safety timeout.
//   6. On every (re)connect we register again with the same name + token.
//
// State lives in a reducer so every change is one small, named action.
// ===========================================================================
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  socket,
  loadToken,
  saveToken,
  normalizeName,
  type ChatMessage,
  type PublicUser,
} from '../lib/socket';
import { toast } from '../lib/toast';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
interface ChatState {
  me: string | null;
  users: Record<string, PublicUser>; // everyone the server knows, incl. me
  conversations: Record<string, ChatMessage[]>; // by the OTHER person's name
  unread: Record<string, number>;
  typing: Record<string, boolean>; // who is typing to me right now
  activePeer: string | null;
  /** short text for the screen reader live region */
  announcement: string;
}

const initial: ChatState = {
  me: null,
  users: {},
  conversations: {},
  unread: {},
  typing: {},
  activePeer: null,
  announcement: '',
};

type Action =
  | { type: 'registered'; me: string; users: PublicUser[]; history: ChatMessage[] }
  | { type: 'user'; user: PublicUser }
  | { type: 'message'; message: ChatMessage }
  | { type: 'typing'; from: string; isTyping: boolean }
  | { type: 'open'; peer: string | null };

// The other side of a message, from my point of view.
const peerOf = (m: ChatMessage, me: string) => (m.from === me ? m.to : m.from);

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    // Fresh login or re-login: replace users and rebuild conversations.
    case 'registered': {
      const users: Record<string, PublicUser> = {};
      action.users.forEach((u) => (users[u.name] = u));
      const conversations: Record<string, ChatMessage[]> = {};
      action.history.forEach((m) => {
        const p = peerOf(m, action.me);
        (conversations[p] ??= []).push(m);
      });
      // Keep the open chat if that person still exists (reconnect case).
      const activePeer = state.activePeer && users[state.activePeer] ? state.activePeer : null;
      return { ...state, me: action.me, users, conversations, activePeer, typing: {} };
    }

    // New user, came online, or went offline. Going offline also drops
    // any "typing…" they left behind.
    case 'user': {
      const users = { ...state.users, [action.user.name]: action.user };
      if (!action.user.online && state.typing[action.user.name]) {
        const typing = { ...state.typing };
        delete typing[action.user.name];
        return { ...state, users, typing };
      }
      return { ...state, users };
    }

    // A message I sent (from the ack) or received (from "message:new").
    case 'message': {
      if (!state.me) return state;
      const m = action.message;
      const p = peerOf(m, state.me);
      const existing = state.conversations[p] ?? [];
      if (existing.some((x) => x.id === m.id)) return state; // no duplicates
      const conversations = { ...state.conversations, [p]: [...existing, m] };

      const incoming = m.from !== state.me;
      const unread =
        incoming && p !== state.activePeer
          ? { ...state.unread, [p]: (state.unread[p] ?? 0) + 1 }
          : state.unread;

      // A message from someone means they stopped typing.
      const typing = { ...state.typing };
      if (incoming) delete typing[m.from];

      const announcement = incoming ? `New message from ${m.from}: ${m.text}` : state.announcement;
      return { ...state, conversations, unread, typing, announcement };
    }

    case 'typing': {
      const was = !!state.typing[action.from];
      if (was === action.isTyping) return state;
      const typing = { ...state.typing };
      if (action.isTyping) typing[action.from] = true;
      else delete typing[action.from];
      const announcement =
        action.isTyping && action.from === state.activePeer
          ? `${action.from} is typing`
          : state.announcement;
      return { ...state, typing, announcement };
    }

    // Opening a chat clears its unread counter.
    case 'open': {
      if (!action.peer) return { ...state, activePeer: null };
      const unread = { ...state.unread };
      delete unread[action.peer];
      return { ...state, activePeer: action.peer, unread };
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useChat() {
  const [state, dispatch] = useReducer(reducer, initial);

  // Refs so socket handlers (registered once) always see current values.
  const meRef = useRef<string | null>(null);
  meRef.current = state.me;
  const activeRef = useRef<string | null>(null);
  activeRef.current = state.activePeer;
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // ---- register (hub method) ---------------------------------------------
  // Resolves with an error string, or null on success.
  const register = useCallback(
    (rawName: string) =>
      new Promise<string | null>((resolve) => {
        const name = normalizeName(rawName);
        socket.emit('register', { name, token: loadToken(name) }, (res) => {
          if (!res.ok) return resolve(res.error);
          saveToken(res.me, res.token);
          dispatch({ type: 'registered', me: res.me, users: res.users, history: res.history });
          resolve(null);
        });
      }),
    [],
  );

  // ---- socket listeners ---------------------------------------------------
  useEffect(() => {
    // After a reconnect (server restart, network drop) log back in quietly.
    const onConnect = () => {
      const me = meRef.current;
      if (me) {
        register(me).then((err) => {
          if (err) toast(`Couldn't log back in: ${err}`);
        });
      }
    };
    const onUser = (user: PublicUser) => dispatch({ type: 'user', user });
    const onMessage = (message: ChatMessage) => dispatch({ type: 'message', message });

    // Typing with a 5s safety timeout in case the "stop" never arrives.
    const onTyping = ({ from, isTyping }: { from: string; isTyping: boolean }) => {
      const timers = typingTimers.current;
      clearTimeout(timers.get(from));
      if (isTyping) {
        timers.set(
          from,
          setTimeout(() => dispatch({ type: 'typing', from, isTyping: false }), 5000),
        );
      }
      dispatch({ type: 'typing', from, isTyping });
    };

    socket.on('connect', onConnect);
    socket.on('user:new', onUser);
    socket.on('user:online', onUser);
    socket.on('user:offline', onUser);
    socket.on('message:new', onMessage);
    socket.on('typing', onTyping);
    const timers = typingTimers.current;
    return () => {
      socket.off('connect', onConnect);
      socket.off('user:new', onUser);
      socket.off('user:online', onUser);
      socket.off('user:offline', onUser);
      socket.off('message:new', onMessage);
      socket.off('typing', onTyping);
      timers.forEach(clearTimeout);
    };
  }, [register]);

  // ---- outgoing typing ----------------------------------------------------
  // Send "typing: true" once when it starts, "false" once when it stops,
  // to the person we told (even if the open chat changed since).
  const typingSentTo = useRef<string | null>(null);
  const setTyping = useCallback((isTyping: boolean) => {
    const peer = activeRef.current;
    if (isTyping) {
      if (!peer || typingSentTo.current === peer) return;
      if (typingSentTo.current) socket.emit('typing', { to: typingSentTo.current, isTyping: false });
      socket.emit('typing', { to: peer, isTyping: true });
      typingSentTo.current = peer;
    } else if (typingSentTo.current) {
      socket.emit('typing', { to: typingSentTo.current, isTyping: false });
      typingSentTo.current = null;
    }
  }, []);

  // ---- message:send (hub method) -------------------------------------------
  const sendMessage = useCallback(
    (text: string) => {
      const to = activeRef.current;
      const clean = text.trim();
      if (!to || !clean) return;
      setTyping(false);
      socket.emit('message:send', { to, text: clean }, (res) => {
        if (res.ok) dispatch({ type: 'message', message: res.message });
        else toast(res.error);
      });
    },
    [setTyping],
  );

  const openChat = useCallback(
    (peer: string | null) => {
      setTyping(false); // leaving a chat mid-typing counts as stopping
      dispatch({ type: 'open', peer });
    },
    [setTyping],
  );

  // Contacts: everyone except me. Online first, then most recent chat,
  // then alphabetical.
  const contacts = useMemo(() => {
    const last = (n: string) => state.conversations[n]?.at(-1)?.time ?? 0;
    return Object.values(state.users)
      .filter((u) => u.name !== state.me)
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return last(b.name) - last(a.name) || a.name.localeCompare(b.name);
      });
  }, [state.users, state.conversations, state.me]);

  return { ...state, contacts, register, sendMessage, setTyping, openChat };
}

export type ChatApi = ReturnType<typeof useChat>;
