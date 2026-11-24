# StreamChat — Architecture

This document describes how StreamChat is designed: the components, the data model, the Socket.IO protocol and the main event flows.

---

## 1. Overview

StreamChat is a single Node.js process that does two jobs:

1. **Static file server** (Express) — serves the client from `public/`.
2. **Real-time hub** (Socket.IO) — keeps a WebSocket connection to every browser tab and routes events between them.

```
                ┌─────────────────────────── server.js ───────────────────────────┐
                │                                                                  │
 HTTP GET / ───▶│  Express static  ──▶  public/index.html, style.css, app.js       │
                │                                                                  │
 WebSocket  ◀──▶│  Socket.IO hub                                                   │
                │    ├─ register        ──▶ users Map                              │
                │    ├─ message:send    ──▶ messages[]  ──▶ room user:<to>         │
                │    ├─ typing          ──────────────────▶ room user:<to>         │
                │    └─ disconnect      ──▶ users Map (offline)                    │
                │                                                                  │
                │  log()  ──▶ console  +  logBuffer  +  io.emit('server:log')      │
                └──────────────────────────────────────────────────────────────────┘
```

## 2. Components

### 2.1 Server (`server.js`)

| Part              | Responsibility                                                                 |
|-------------------|--------------------------------------------------------------------------------|
| Bootstrap         | Creates Express app, HTTP server and Socket.IO server on the same port.        |
| State             | `users` (Map), `messages` (Array), `logBuffer` (ring buffer, 300 entries).     |
| `log()`           | Single logging entry point: console (colored), buffer, broadcast.              |
| Helpers           | `publicUser`, `userList`, `historyFor`, `cleanName`, `onlineCount`.            |
| Hub handlers      | `register`, `message:send`, `typing`, `disconnect`.                            |

### 2.2 Client (`public/app.js`)

| Component      | Responsibility                                                              |
|----------------|-----------------------------------------------------------------------------|
| Log panel      | Renders `server:log` entries and local `client` entries; auto-scroll.       |
| Contacts list  | Sorting, search, presence dots, previews, unread badges, typing state.      |
| Chat view      | Header (status), message bubbles, typing bubble.                            |
| Composer       | Sends messages; debounced typing start/stop events.                         |
| Login          | Calls `register`, loads contacts + history, switches screens.               |
| Socket events  | Listeners for all server → client events; auto re-register on reconnect.    |

## 3. Data model

```js
// User (server-side)
{ name, socketId /* null when offline */, online, lastSeen, registeredAt }

// User (sent to clients — no socket id)
{ name, online, lastSeen }

// Message
{ id, from, to, text, time, delivered }

// Log entry
{ time, level /* info|success|warn|error|msg|typing */, text }
```

## 4. Rooms and routing

On successful registration each socket joins a personal room named `user:<name>`.
All targeted events (`message:new`, `typing`) are emitted to that room rather than to a socket id, so routing keeps working when a user reconnects with a new socket.

Broadcast events (`user:offline`, `server:log`) go to every socket; `user:new` and `user:online` go to everyone except the sender.

## 5. Event flows

### 5.1 Registration

```
Client A                         Server                               Others
   │ register {name:"Alice"}       │                                     │
   │ ─────────────────────────────▶│ validate · create/restore user      │
   │                               │ join room user:Alice                │
   │ ◀──── ack {me, users, history}│                                     │
   │                               │ ── user:new (if first time) ──────▶ │
   │                               │ ── user:online ──────────────────▶  │
   │                               │ ── server:log (to everyone) ──────▶ │
```

Rejected cases:
- the socket is **already registered** (one identity per socket — prevents a stale identity staying online and a socket remaining in another user's room);
- empty name;
- the name is already online.

A reconnect is not affected by the first rule because Socket.IO always creates a new socket on reconnect.

### 5.2 Sending a message

```
Bob                              Server                              Alice
 │ message:send {to:"Alice",text}  │                                   │
 │ ───────────────────────────────▶│ validate · store message          │
 │                                 │ ── message:new ─────────────────▶ │ (room user:Alice)
 │ ◀──────── ack {ok, message}     │                                   │
 │ render own bubble               │ ── server:log ──▶ everyone        │
```

If Alice is offline the message is stored with `delivered:false` and returned in her `history` on next login.

### 5.3 Typing indicator

- The client sends `typing {isTyping:true}` **once** when typing starts.
- It sends `typing {isTyping:false}` after 1.5 s of inactivity, on blur, on empty input, or when the message is sent.
- The server records, per socket, which users it is currently typing to (`socket.data.typingTo`).
- If the socket disconnects mid-typing, the server sends `typing {isTyping:false}` to each of those users itself.
- The receiver also clears the indicator after a 5 s safety timeout, when a message from that user arrives, or on `user:offline`.

### 5.4 Disconnect

When a socket disconnects, the server first closes any open typing indicators for that socket (see 5.3), then marks the user offline **only if** that socket is still the user's active socket (prevents a stale socket from overriding a fresh login), updates `lastSeen` and broadcasts `user:offline`.

### 5.5 Reconnect

Socket.IO reconnects automatically. On `connect`, if the client was already logged in, it calls `register` again with the same name and restores contacts, history and the open chat.

## 6. Security notes

- All user text is rendered with `textContent` (never `innerHTML`) to prevent HTML/script injection.
- Names are trimmed, whitespace-collapsed and limited to 24 characters; messages to 2000 characters.
- Socket ids are never sent to other clients.
- Acknowledgement callbacks are wrapped with `toAck()`, so a client sending a non-function as the last argument cannot crash a handler.
- There is no authentication — this is a simulator, not a production messenger.

## 7. Extending the project

- **Persistence:** replace the `users` Map and `messages` array with a database layer; keep the hub API unchanged.
- **Group chats:** add a `room:<id>` naming scheme and `room:join` / `room:message` events.
- **Read receipts:** add a `message:read` event and a `readAt` field on messages.
