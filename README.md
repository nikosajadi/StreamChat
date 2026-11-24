# StreamChat

A lightweight, real-time **messenger simulator** built with **Node.js**, **Express** and **Socket.IO**.
It runs a server that registers clients, relays private messages, broadcasts typing indicators and online/offline presence, and a minimal dark-themed web client that looks and behaves like a modern messenger — including a live **Server & Socket Log** panel that shows every event as it happens.

> Purpose: a clean, well-commented reference project for learning and demonstrating real-time communication patterns with Socket.IO.

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Quick start](#quick-start)
4. [How to use](#how-to-use)
5. [Project structure](#project-structure)
6. [Architecture](#architecture)
7. [Socket.IO event reference](#socketio-event-reference)
8. [Configuration](#configuration)
9. [Limitations](#limitations)
10. [Roadmap](#roadmap)
11. [Changelog](#changelog)

---

## Features

**Server**
- Registers users by display name (unique while online); returning users log back in with their history.
- Relays private one-to-one messages in real time; stores messages for offline users.
- Forwards "is typing" indicators to the intended recipient only.
- Tracks presence (online / offline / last seen) and broadcasts changes to all clients.
- Logs every server and socket event (in English) to the terminal **and** streams it to every connected client.

**Client**
- Login screen — pick a name to join.
- Contact list with avatars, green online dot, *last seen*, last-message preview, unread badges and search.
- New users appear in the contact list instantly (with a highlight animation).
- Chat view with message bubbles, timestamps and an animated typing indicator.
- Live **Server & Socket Log** panel (toggle with the ⌘ button).
- Automatic re-registration after a reconnect (network drop or server restart).
- Minimal dark theme; all colors are defined once as CSS variables.

## Tech stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Runtime    | Node.js (v18+ recommended; tested on v20)    |
| HTTP       | Express 4                                    |
| Real-time  | Socket.IO 4                                  |
| Client     | Vanilla HTML, CSS and JavaScript (no build)  |
| Storage    | In-memory (no database)                      |

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open the client
#    http://localhost:3000
```

Open the URL in **two or more browser tabs** (or different browsers) and join with different names to simulate a conversation.

## How to use

1. Enter a name on the login screen and press **Join**.
2. Other registered users appear in the **Contacts** list on the left. A green dot means online.
3. Click a contact to open the chat, type a message and press **Enter** (or the send button).
4. While you type, the other side sees *typing…* in their contact list and chat header.
5. Close a tab to see that user go **offline** for everyone else.
6. Watch the **Server & Socket Log** panel on the right to follow every event.

## Project structure

```
StreamChat/
├── server.js          # Express + Socket.IO server (state, hub methods, logging)
├── package.json       # Dependencies and npm scripts
├── public/            # Static client served by Express
│   ├── index.html     # Page skeleton: login + 3-column layout
│   ├── style.css      # Minimal dark theme
│   └── app.js         # Client logic: socket events, rendering, typing, login
├── docs/
│   └── ARCHITECTURE.md  # Detailed design, data flow and sequence diagrams
├── CHANGELOG.md       # Version history
└── README.md
```

## Architecture

```
┌──────────────┐   WebSocket (Socket.IO)   ┌──────────────────────────┐
│  Browser tab │ ◀───────────────────────▶ │        server.js         │
│  (app.js)    │                           │  Express (static files)  │
└──────────────┘                           │  Socket.IO hub           │
┌──────────────┐                           │  In-memory state:        │
│  Browser tab │ ◀───────────────────────▶ │   users · messages · log │
└──────────────┘                           └──────────────────────────┘
```

- Each user joins a personal room `user:<name>`; messages and typing events are sent to that room.
- The server is the single source of truth: a sent message is rendered only after the server acknowledges it.
- Every event goes through one `log()` function that writes to the console and broadcasts `server:log`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design and sequence diagrams.

## Socket.IO event reference

### Client → Server

| Event          | Payload              | Ack response                                          | Description                         |
|----------------|----------------------|-------------------------------------------------------|-------------------------------------|
| `register`     | `{ name }`           | `{ ok, me, users, history }` or `{ ok:false, error }` | Register a new user or log back in. |
| `message:send` | `{ to, text }`       | `{ ok, message }` or `{ ok:false, error }`            | Send a private message.             |
| `typing`       | `{ to, isTyping }`   | —                                                     | Start / stop typing indicator.      |

### Server → Client

| Event          | Payload                                   | Sent to                 | Description                          |
|----------------|-------------------------------------------|-------------------------|--------------------------------------|
| `server:logs`  | `[ { time, level, text } ]`               | the connecting socket   | Recent log history.                  |
| `server:log`   | `{ time, level, text }`                   | everyone                | One new log entry.                   |
| `user:new`     | `{ name, online, lastSeen }`              | everyone except sender  | A brand-new user registered.         |
| `user:online`  | `{ name, online, lastSeen }`              | everyone except sender  | A user came online.                  |
| `user:offline` | `{ name, online, lastSeen }`              | everyone                | A user went offline.                 |
| `message:new`  | `{ id, from, to, text, time, delivered }` | recipient's room        | Incoming message.                    |
| `typing`       | `{ from, isTyping }`                      | recipient's room        | Someone is (not) typing to you.      |

Log levels: `info`, `success`, `warn`, `error`, `msg`, `typing` (server) and `client` (local, client-only).

## Configuration

| Variable | Default | Description          |
|----------|---------|----------------------|
| `PORT`   | `3000`  | HTTP / Socket port.  |

```bash
PORT=4000 npm start            # macOS / Linux
$env:PORT=4000; npm start      # Windows PowerShell
```

## Limitations

- **In-memory only** — restarting the server clears all users and messages.
- **No authentication** — a name is the identity; anyone can take a name that is currently offline.
- **One active tab per name** — the same name cannot be online twice.
- On screens narrower than 1000 px the log panel is hidden.

## Roadmap

- [ ] Persistent storage (SQLite / MongoDB)
- [ ] Read receipts (sent / delivered / seen)
- [ ] Group chats / rooms
- [ ] Authentication
- [ ] Mobile-friendly layout

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
