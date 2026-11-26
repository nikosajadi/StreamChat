# How StreamChat works

Notes on how the pieces fit together: what the server keeps in memory, which events go where, and what happens in the main cases (joining, sending, typing, leaving).

## The big picture

There are two parts:

1. **Server** (`server.js`): one Node.js process. Socket.IO keeps a connection open to every tab and passes events between them. In production, Express also serves the built React client from `client/dist`.
2. **Client** (`client/`): a React + TypeScript app built with Vite. In development Vite serves it on port 5173 and forwards `/socket.io` to the server, so the browser only ever talks to one address.

```
 Development                                   Production

 browser ──▶ Vite :5173 ──/socket.io──▶ :3000   browser ──▶ server.js :3000
             (React app,   proxy, ws too)                    ├─ Express static: client/dist
              hot reload)                                    └─ Socket.IO
```

Inside the server:

```
                ┌─────────────────────────── server.js ───────────────────────────┐
                │                                                                  │
 HTTP GET / ───▶│  Express static  ──▶  client/dist (built React app)              │
                │                                                                  │
 WebSocket  ◀──▶│  Socket.IO                                                       │
                │    ├─ register        ──▶ users Map                              │
                │    ├─ message:send    ──▶ messages[]  ──▶ room user:<to>         │
                │    ├─ message:read    ──▶ messages[]  ──▶ room user:<sender>     │
                │    ├─ typing          ──────────────────▶ room user:<to>         │
                │    └─ disconnect      ──▶ users Map (offline)                    │
                │                                                                  │
                │  log(level, text, meta) ──▶ console + logBuffer + server:log     │
                └──────────────────────────────────────────────────────────────────┘
```

## Server (server.js)

- Setup: Express app, HTTP server and Socket.IO on the same port. Serves `client/dist` if it exists, otherwise `/` says to run the build.
- State: `users` (a Map by name), `messages` (last 1000 messages), `logBuffer` (last 300 log lines).
- `log(level, text, meta?)`: the one place everything gets logged. Prints a colored line in the terminal, saves it in the buffer and sends it to every tab. `meta` tells clients what the line is about (see below).
- Small helpers: `publicUser`, `userList`, `historyFor`, `cleanName`, `onlineCount`, `setStatus`, `toAck`.
- Socket handlers: `register`, `message:send`, `message:read`, `typing`, `disconnect`.

## Client (client/src)

How the code is split:

- `lib/socket.ts`: creates the one socket for the whole app and has the TypeScript types for every event (`ServerToClientEvents`, `ClientToServerEvents`), matching `server.js`. Also the token helpers (`loadToken`, `saveToken`) and a small buffer of log lines that arrive before React has mounted.
- `hooks/useChat.ts`: a reducer with users, conversations, unread counts, who's typing, and the open chat. Has `register`, `sendMessage`, `setTyping` and `openChat`. Logs back in by itself after a reconnect. Also sends `message:read` and updates the ticks from `message:status`.
- `hooks/useConnection.ts`: Connecting / Connected / Reconnecting / Offline, from the socket's own events and the browser's online/offline events.
- `hooks/useLiveWire.ts`: keeps the event log (newest first, max 200), the filter, pause, and a short-lived list of animations for the diagram.
- `hooks/useTheme.ts`: Paper or Night ink. First visit follows the system, after that the saved choice wins.
- `components/`: grouped by area (`auth`, `contacts`, `chat`, `livewire`, `ui`). They get data as props and don't touch the socket directly.

Design tokens (colors, fonts, radii) are defined once: CSS variables for both themes in `src/index.css`, and names for them in `tailwind.config.ts`. Components only use those names. Small accent text uses `accent-ink`, a darker terracotta, so it passes WCAG AA.

### Layout

- Desktop (1024px and up): contacts | chat | Live Wire, and Live Wire can be closed.
- Tablet (768 to 1023px): contacts | chat. Live Wire slides in from the right.
- Phone (under 768px): contacts and chat are separate screens with a back button. Live Wire is a bottom sheet.

The overlays are modal: focus goes in, Escape or the backdrop closes them, and focus goes back to the button.

### Live Wire

The server's log lines carry `meta`, so the client doesn't have to read the text:

| `meta.type` | Sent for | What the diagram does |
|-------------|----------|------------------------|
| `message`   | a message was sent, or stored messages got delivered, or someone read messages (`from`, `to`) | terracotta dot: from → server → to. For a receipt that's the reader going back to the sender |
| `typing`    | typing started or stopped (`from`, `to`, `isTyping`) | smaller grey dot along the same path |
| `register`  | new user or logged back in (`from`) | indigo ring on that user |
| `presence`  | came online / went offline (`from`, `online`) | indigo ring on that user |
| `system`    | socket connect/disconnect, server start | small ring on the server |

Lines without `meta` (like a rejected register) count as System, and warnings show in muted red. Users are placed on an ellipse around the server in name order, and offline ones are faded. With "reduce motion" turned on, nothing moves: the nodes involved just get a colored ring for a moment.

The log list under the diagram can be filtered and paused. Pausing only freezes the list. New lines are held back and counted, and the diagram keeps moving.

### Avatars and background

Both are generated in code (`lib/art.ts`). A name is hashed into a seed, and the seed drives a small random generator. So the same name always gets the same blob shape and colors, and the chat background always looks the same. The background can be swapped for a picture by adding `client/src/assets/art/wallpaper.jpg`.

## What the data looks like

```js
// user, on the server
{ name, token, socketId /* null when offline */, online, lastSeen, registeredAt }

// user, as sent to other clients (no token, no socket id)
{ name, online, lastSeen }

// message (status only moves forward; delivered is the old flag, true unless status is 'sent')
{ id, from, to, text, time, delivered, status /* sent|delivered|read */ }

// log line (meta is optional, never has message text or tokens)
{ time, level /* info|success|warn|error|msg|typing */, text,
  meta?: { type /* message|typing|presence|register|system */, from?, to?, online?, isTyping? } }
```

## Rooms

After you register, your socket joins a room named `user:<name>`. Messages and typing events for you are sent to that room instead of to a socket id. That way it keeps working after you reconnect and get a new socket.

`user:offline` and `server:log` go to everyone. `user:new` and `user:online` go to everyone except the user it's about.

## Main flows

### Joining

```
Client A                         Server                               Others
   │ register {name:"Alice"}       │                                     │
   │ ─────────────────────────────▶│ check name, create or restore user  │
   │                               │ join room user:Alice                │
   │ ◀──── reply {me, users, history}                                    │
   │                               │ ── user:new (first time only) ────▶ │
   │                               │ ── user:online ──────────────────▶  │
   │                               │ ── server:log (to everyone) ──────▶ │
```

The server says no if:
- this socket already registered (one name per socket, see 1.0.1 in the changelog),
- the name is empty,
- someone with that name is already online,
- the name exists but is offline and the token doesn't match ("This name is already taken.").

New names get a token from `crypto.randomUUID()`. It comes back only in the register reply, and the browser stores it in localStorage as `streamchat:token:<name>`. The browser sends it with every register, including automatic ones after a reconnect.

The first rule doesn't get in the way of reconnecting, because Socket.IO always makes a new socket when it reconnects.

### Sending a message

```
Bob                              Server                              Alice
 │ message:send {to:"Alice",text}  │                                   │
 │ ───────────────────────────────▶│ check it, save it                 │
 │                                 │ ── message:new ─────────────────▶ │ (room user:Alice)
 │ ◀──────── reply {ok, message}   │                                   │
 │ show own bubble                 │ ── server:log ──▶ everyone        │
```

If Alice is offline the message is saved with `status: 'sent'` and she gets it in her history next time she logs in.

### Ticks (read receipts)

```
Bob                              Server                              Alice
 │                                 │ ◀── register (Alice comes back)   │
 │ ◀── message:status {ids, delivered}  sent → delivered               │
 │                                 │                                   │
 │                                 │ ◀── message:read {peer:"Bob"} ─── │ opens the chat
 │ ◀── message:status {ids, read}  │ delivered → read                  │
```

- A message starts as `delivered` if Alice is online, or `sent` if not.
- When Alice logs in, everything waiting for her turns `delivered` (before her history is sent back), and each sender gets `message:status`.
- Alice's browser sends `message:read { peer }` when she opens a chat, when a message comes into the chat she has open, and when she comes back to the tab. Not while the tab is hidden. The server uses `socket.data.name` as the reader, never something from the payload.
- `setStatus()` on the server only moves a message forward and sends `message:status` only to the sender's room. On the client the reducer does the same check, so a late update can't move a tick back.
- Nothing is logged when a `message:read` changes nothing, otherwise every chat switch would add a line.

Sending to yourself is rejected. Only the last 1000 messages are kept; older ones are dropped.

The log line for a message only has the id, sender, receiver, delivered or stored, and the length. Never the text, because the log is sent to every tab.

### Typing

- The client sends `typing {isTyping: true}` once when you start typing, not on every key.
- It sends `typing {isTyping: false}` after 1.5 seconds of no typing, when you leave the input box, when you clear it, or when you send.
- The server remembers who each socket is typing to (`socket.data.typingTo`).
- If the socket disconnects while typing, the server sends `isTyping: false` to those people itself.
- On the receiving side the indicator also clears after 5 seconds, when a message from that person arrives, or when they go offline.

### Leaving

When a socket disconnects, the server first closes any typing indicators it left open, then marks the user offline. It only does that if this socket is still the user's current one, so an old socket closing late can't knock out a fresh login. Then `lastSeen` is updated and `user:offline` goes out to everyone.

### Reconnecting

Socket.IO reconnects by itself. When it does, the page calls `register` again with the same name and token and puts back the contacts, messages and the chat you had open. Reloading the page does the same: the tab remembers its name in sessionStorage, and if the token is there it logs back in without asking.

## Safety stuff

- All user text is rendered as normal React text, which React escapes. The client never uses `dangerouslySetInnerHTML` (or `innerHTML`), so nobody can inject HTML or scripts. Escaping happens in the browser when rendering, not on the server.
- Names can't be taken over while their owner is offline, thanks to the token.
- Message text never shows up in the log or in `meta`, and neither do tokens.
- Names are trimmed and cut to 24 characters. Messages are cut to 2000.
- Socket ids are never sent to other users.
- Reply callbacks go through `toAck()`, so a client sending junk instead of a function can't crash the server.
- There's no real login. It's a toy, not something to put on the internet as is.

## If you want to extend it

- Database: swap the `users` Map and `messages` array for a database. The socket events can stay the same.
- Group chats: add rooms like `room:<id>` and events like `room:join` and `room:message`.
- Read time: ticks are there now, but there's no "read at 14:02". A `readAt` field on messages would do it.
