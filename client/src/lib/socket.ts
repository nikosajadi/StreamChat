// ===========================================================================
// lib/socket.ts: the one Socket.IO connection for the whole app.
// ---------------------------------------------------------------------------
// The types below mirror server.js exactly. If you add or change an event on
// the server, change it here too and TypeScript will point at every place
// in the client that needs updating.
//
//   Client -> Server            Server -> Client
//   -----------------           -------------------------------------------
//   register     (ack)          server:logs   (log history, on connect)
//   message:send (ack)          server:log    (one new log entry, to all)
//   message:read                user:new      (a brand-new user registered)
//   typing                      user:online   (a user came online)
//                               user:offline  (a user went offline)
//                               message:new   (incoming message)
//                               message:status (my messages delivered/read)
//                               typing        (someone is typing to you)
// ===========================================================================
import { io, type Socket } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Shared data shapes (same as server.js)
// ---------------------------------------------------------------------------

/** A user as the server broadcasts it (never contains a token or socket id). */
export interface PublicUser {
  name: string;
  online: boolean;
  lastSeen: number;
}

/**
 * Where a message is, for the ticks under my own bubbles:
 *   sent      = stored by the server (one grey tick)
 *   delivered = in the recipient's browser (two grey ticks)
 *   read      = they opened the chat and saw it (two terracotta ticks)
 * It only moves forward.
 */
export type MessageStatus = 'sent' | 'delivered' | 'read';

/** A stored private message. */
export interface ChatMessage {
  id: number;
  from: string;
  to: string;
  text: string;
  time: number;
  /** older flag, true when status isn't 'sent'. Use `status` instead. */
  delivered: boolean;
  status: MessageStatus;
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'msg' | 'typing';

/** What a log entry is about. Added so Live Wire doesn't parse text. */
export type LogMetaType = 'message' | 'typing' | 'presence' | 'register' | 'system';

export interface LogMeta {
  type: LogMetaType;
  from?: string;
  to?: string;
  /** presence only: true = came online, false = went offline */
  online?: boolean;
  /** typing only: true = started, false = stopped */
  isTyping?: boolean;
}

/** One line of the server log. `meta` is missing on older/unstructured lines. */
export interface LogEntry {
  time: number;
  level: LogLevel;
  text: string;
  meta?: LogMeta;
}

// ---------------------------------------------------------------------------
// Ack payloads
// ---------------------------------------------------------------------------
export type Fail = { ok: false; error: string };

export type RegisterAck =
  | { ok: true; me: string; token: string; users: PublicUser[]; history: ChatMessage[] }
  | Fail;

export type SendAck = { ok: true; message: ChatMessage } | Fail;

// ---------------------------------------------------------------------------
// Event maps
// ---------------------------------------------------------------------------
export interface ServerToClientEvents {
  'server:logs': (entries: LogEntry[]) => void;
  'server:log': (entry: LogEntry) => void;
  'user:new': (user: PublicUser) => void;
  'user:online': (user: PublicUser) => void;
  'user:offline': (user: PublicUser) => void;
  'message:new': (message: ChatMessage) => void;
  /** some of MY messages changed status (only sent to the sender) */
  'message:status': (payload: { ids: number[]; status: MessageStatus }) => void;
  typing: (payload: { from: string; isTyping: boolean }) => void;
}

export interface ClientToServerEvents {
  register: (payload: { name: string; token?: string }, ack: (res: RegisterAck) => void) => void;
  'message:send': (payload: { to: string; text: string }, ack: (res: SendAck) => void) => void;
  /** "I've seen everything `peer` sent me" */
  'message:read': (payload: { peer: string }) => void;
  typing: (payload: { to: string; isTyping: boolean }) => void;
}

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ---------------------------------------------------------------------------
// The single socket instance
// ---------------------------------------------------------------------------
// Same origin in both dev (Vite proxies /socket.io to :3000) and prod
// (server.js serves this app). autoConnect: the server starts streaming log
// lines right away, before the user has even picked a name.
export const socket: ChatSocket = io({ autoConnect: true });

// Dev only: if this file is edited, hot reload would create a SECOND socket
// next to the old (registered) one. Close the old one and reload the page.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    socket.close();
    window.location.reload();
  });
}

// ---------------------------------------------------------------------------
// Early log buffer
// ---------------------------------------------------------------------------
// The server sends "server:logs" (history) right after connecting, which can
// happen before React has mounted and attached its listeners. So we keep a
// copy here from the very start; useLiveWire reads it when it subscribes.
const earlyLog: LogEntry[] = [];
const EARLY_LIMIT = 200;
socket.on('server:logs', (list) => {
  earlyLog.length = 0;
  earlyLog.push(...list.slice(-EARLY_LIMIT));
});
socket.on('server:log', (entry) => {
  earlyLog.push(entry);
  if (earlyLog.length > EARLY_LIMIT) earlyLog.shift();
});

/** Every log line received so far (oldest first). */
export const getLogSnapshot = (): LogEntry[] => earlyLog.slice();

// ---------------------------------------------------------------------------
// Session token storage
// ---------------------------------------------------------------------------
// The server gives each name a secret token on first register. We keep it in
// localStorage as "streamchat:token:<name>" and send it on every register so
// only this browser can log back in with that name. Storage can throw in
// private mode or when disabled, so every access is wrapped.

/** Same cleanup the server does (trim, single spaces, 24 chars). */
export const normalizeName = (raw: string) => raw.trim().replace(/\s+/g, ' ').slice(0, 24);

const tokenKey = (name: string) => `streamchat:token:${normalizeName(name)}`;

export function loadToken(name: string): string | undefined {
  try {
    return localStorage.getItem(tokenKey(name)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveToken(name: string, token: string): void {
  try {
    localStorage.setItem(tokenKey(name), token);
  } catch {
    /* storage blocked: the user just can't log back in after a restart */
  }
}
