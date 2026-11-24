# How StreamChat works

Notes on how the pieces fit together: what the server keeps in memory, which events go where, and what happens in the main cases (joining, sending, typing, leaving).

## The big picture

It's one Node.js process doing two things:

1. Express serves the files in `public/`.
2. Socket.IO keeps a connection open to every tab and passes events between them.

```
                ┌─────────────────────────── server.js ───────────────────────────┐
                │                                                                  │
 HTTP GET / ───▶│  Express static  ──▶  public/index.html, style.css, app.js       │
                │                                                                  │
 WebSocket  ◀──▶│  Socket.IO                                                       │
                │    ├─ register        ──▶ users Map                              │
                │    ├─ message:send    ──▶ messages[]  ──▶ room user:<to>         │
                │    ├─ typing          ──────────────────▶ room user:<to>         │
                │    └─ disconnect      ──▶ users Map (offline)                    │
                │                                                                  │
                │  log()  ──▶ console  +  logBuffer  +  io.emit('server:log')      │
                └──────────────────────────────────────────────────────────────────┘
```

## Server (server.js)

- Setup: Express app, HTTP server and Socket.IO on the same port.
- State: `users` (a Map by name), `messages` (last 1000 messages), `logBuffer` (last 300 log lines).
- `log()`: the one place everything gets logged. Prints a colored line in the terminal, saves it in the buffer and sends it to every tab.
- Small helpers: `publicUser`, `userList`, `historyFor`, `cleanName`, `onlineCount`, `toAck`.
- Socket handlers: `register`, `message:send`, `typing`, `disconnect`.

## Client (public/app.js)

- Log panel: shows log lines from the server plus a few of its own (`client` level). Only auto-scrolls if you're already at the bottom.
- Contact list: sorting, search, online dots, last message, unread count, "typing…".
- Chat: header with status, message bubbles, the three-dot typing bubble.
- Input box: sends messages and the typing start/stop events.
- Emoji picker: the smiley button opens a panel built once from a list in `app.js` (`EMOJI_GROUPS`). Clicking an emoji inserts it at the cursor and fires a normal `input` event, so the typing indicator works the same as with the keyboard. Emoji buttons use `mousedown` + `preventDefault` so the message box keeps focus.
- Big emoji: `isBigEmoji()` checks if a message is only emoji and at most 3 of them (counted with `Intl.Segmenter`, so things like ❤️ count as one). Those bubbles get the `big-emoji` class.
- Login: calls `register`, loads contacts and old messages, switches screens.
- Socket listeners for everything the server sends. Logs back in by itself after a reconnect.

## What the data looks like

```js
// user, on the server
{ name, token, socketId /* null when offline */, online, lastSeen, registeredAt }

// user, as sent to other clients (no token, no socket id)
{ name, online, lastSeen }

// message
{ id, from, to, text, time, delivered }

// log line
{ time, level /* info|success|warn|error|msg|typing */, text }
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

If Alice is offline the message is saved with `delivered: false` and she gets it in her history next time she logs in.

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

Socket.IO reconnects by itself. When it does, the page calls `register` again with the same name and puts back the contacts, messages and the chat you had open.

## Safety stuff

- User text is always put on the page with `textContent` or `createTextNode`. The client doesn't use `innerHTML` anywhere, so nobody can inject HTML or scripts. Escaping happens in the browser when rendering, not on the server.
- Names can't be taken over while their owner is offline, thanks to the token.
- Message text never shows up in the log.
- Names are trimmed and cut to 24 characters. Messages are cut to 2000.
- Socket ids are never sent to other users.
- Reply callbacks go through `toAck()`, so a client sending junk instead of a function can't crash the server.
- There's no real login. It's a toy, not something to put on the internet as is.

## If you want to extend it

- Database: swap the `users` Map and `messages` array for a database. The socket events can stay the same.
- Group chats: add rooms like `room:<id>` and events like `room:join` and `room:message`.
- Seen ticks: add a `message:read` event and a `readAt` field on messages.
