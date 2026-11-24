# StreamChat

A small messenger I built to play with Socket.IO. There's a Node.js server that keeps track of who's online and passes messages around, and a simple dark-themed web page that works like a chat app.

On the right side of the page there's a log panel that shows what the server is doing in real time (who connected, who's typing, who sent what), which is handy for seeing how the events flow.

## What it does

Server:
- Users join with just a name. If you come back with the same name later, you get your old messages back.
- Private one-to-one messages. If the other person is offline, the message is kept and they'll see it when they come back.
- Typing indicator, sent only to the person you're chatting with.
- Online / offline / last seen for everyone.
- Every event is printed in the terminal and also sent to the log panel in the browser.

Client:
- Login screen, contact list, chat window.
- Green dot for online users, "last seen" for offline ones.
- Last message preview, unread count, and search in the contact list.
- New users show up in the list right away.
- "typing…" under the name and three dots in the chat.
- Log panel you can hide with the ⌘ button.
- If the connection drops or the server restarts, the page logs you back in by itself.

## Stack

- Node.js (I used v20, v18+ should be fine)
- Express 4 for serving the page
- Socket.IO 4 for the real-time part
- Plain HTML, CSS and JS on the client, no build step
- No database, everything lives in memory

## Running it

```bash
npm install
npm start
```

Then go to http://localhost:3000.

Open it in two or more tabs (or two browsers) and join with different names to chat between them.

To use another port:

```bash
PORT=4000 npm start            # macOS / Linux
$env:PORT=4000; npm start      # Windows PowerShell
```

## How to use

1. Type a name and hit Join.
2. Other users show up on the left. Green dot means online.
3. Click someone, type, hit Enter.
4. While you type, they see "typing…".
5. Close a tab and that user goes offline for everyone else.
6. Watch the log panel on the right to see what's going on.

## Files

```
StreamChat/
├── server.js            server: state, socket events, logging
├── package.json
├── public/
│   ├── index.html       page layout
│   ├── style.css        dark theme
│   └── app.js           client logic
├── docs/
│   ├── ARCHITECTURE.md  how it works under the hood
│   └── TESTING.md       manual tests to run after changes
├── CHANGELOG.md
└── README.md
```

## How it works (short version)

Every tab opens a socket to the server. When you register, your socket joins a room called `user:<your name>`. Messages and typing events for you get sent to that room. The server keeps users, messages and the last 300 log lines in memory.

A message you send only shows up on your side after the server confirms it, so what you see is what was actually saved.

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Socket events

Client to server:

| Event          | Payload            | Reply                                                | What it does                           |
|----------------|--------------------|------------------------------------------------------|----------------------------------------|
| `register`     | `{ name }`         | `{ ok, me, users, history }` or `{ ok:false, error }` | Join or log back in. Once per socket.  |
| `message:send` | `{ to, text }`     | `{ ok, message }` or `{ ok:false, error }`            | Send a private message.                |
| `typing`       | `{ to, isTyping }` | none                                                 | Started / stopped typing.              |

Server to client:

| Event          | Payload                                   | Who gets it              | What it means                  |
|----------------|-------------------------------------------|--------------------------|--------------------------------|
| `server:logs`  | list of log entries                       | the tab that just connected | Recent log history.         |
| `server:log`   | `{ time, level, text }`                   | everyone                 | One new log line.              |
| `user:new`     | `{ name, online, lastSeen }`              | everyone but the new user | Someone new joined.           |
| `user:online`  | `{ name, online, lastSeen }`              | everyone but that user   | Someone came online.           |
| `user:offline` | `{ name, online, lastSeen }`              | everyone                 | Someone went offline.          |
| `message:new`  | `{ id, from, to, text, time, delivered }` | the receiver             | New message for you.           |
| `typing`       | `{ from, isTyping }`                      | the receiver             | Someone is (or stopped) typing to you. |

Log levels: `info`, `success`, `warn`, `error`, `msg`, `typing` from the server, and `client` for things only your own tab logs.

## Things to know

- Everything is in memory. Restart the server and it's all gone.
- No passwords. Your name is your identity, so anyone can take a name that's currently offline.
- One tab per name at a time.
- On screens narrower than 1000px the log panel is hidden.

## Ideas for later

- [ ] Save users and messages in a database (SQLite or MongoDB)
- [ ] Seen / delivered ticks
- [ ] Group chats
- [ ] Login with a password
- [ ] Better layout on phones

## Changes

See [CHANGELOG.md](CHANGELOG.md).
