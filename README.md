# StreamChat

A small chat app I made to learn Socket.IO.

There's a Node.js server and a React front end. You pick a name, you see who else is online, and you can send private messages. You can see when someone is typing and when people come and go.

On the right there's a panel called Live Wire. It shows the server in the middle and the users around it, and every time a message or a typing event goes through the server you see a little dot move. Under it is a list of everything the server did. I added it because I wanted to actually see the events, not just read about them.

## What you can do

- Join with just a name. No password.
- See everyone else. Online people are at the top, offline people show "last seen".
- Send private messages. If the other person is offline, they get it when they come back.
- See "typing…" when someone is writing to you.
- Ticks under your messages, like WhatsApp: one grey tick when the server has it, two grey when it reached the other person's browser, two orange when they opened the chat and saw it.
- Unread counts, search, emoji.
- Light and dark theme (the moon/sun button at the top).
- Works on a phone too. Contacts and chat become two screens.
- If the page reloads or the connection drops, you get logged back in.

## What it's made with

- Server: Node.js, Express, Socket.IO
- Front end: React, TypeScript, Vite, Tailwind CSS, framer-motion (animations), lucide-react (icons)
- No database. Everything is kept in memory, so restarting the server clears it.

I used Node 20.

## How to run it

You need Node.js installed. Then, in the project folder:

### 1. Install (only the first time)

```bash
npm install
npm run client:install
```

The first one is for the server, the second one is for the React app in `client/`.

### 2. Run it

There are two ways.

**Normal way** (one terminal):

```bash
npm run build
npm start
```

`npm run build` makes the React app. `npm start` starts the server. Open http://localhost:3000.

You only need to run `npm run build` again if you change the React code.

**While working on the code** (two terminals):

```bash
npm run dev:server
```

```bash
npm run dev:client
```

Open http://localhost:5173. Changes in the React code show up right away, no build needed.

### 3. Try it

Open the page in two tabs (or two browsers), join with two different names, and talk to yourself.

### Putting it online (free, on Render)

The repo has a `render.yaml`, so [Render](https://render.com) can set everything up by itself:

1. Make a free account on render.com (signing in with GitHub is easiest).
2. In the dashboard click **New** → **Blueprint** and pick this repo. Give it access to the repo if it asks.
3. Render reads `render.yaml` and shows one web service called `streamchat` on the free plan. Click **Apply** (or **Deploy**).
4. The first build takes a few minutes. When it's done you get a link like `https://streamchat-xxxx.onrender.com`.

After that, every push to `main` goes live by itself.

On the free plan the server falls asleep after about 15 minutes with nobody on it. The next person waits around a minute while it wakes up. Sleeping also clears all users and messages, because everything is in memory.

What the build does: `npm run build:deploy` (installs the server, installs the client with its dev tools, builds the client). Then `npm start`. The server picks up Render's `PORT` by itself.

### If something doesn't work

- **Page doesn't open:** the server probably isn't running. Run `npm start` again.
- **"The client is not built yet":** run `npm run build`, then `npm start`.
- **`EADDRINUSE` error:** something is already using port 3000, probably another copy of the server. Close it (Ctrl+C in its terminal), or use another port: `PORT=4000 npm start` (Windows PowerShell: `$env:PORT=4000; npm start`).
- **"This name is already taken":** someone used that name before from another browser. Pick another name, or restart the server to free all names.

## Folders

```
StreamChat/
├── server.js          the server
├── package.json       scripts: start, build, build:deploy, dev:server, dev:client
├── render.yaml        settings for putting it online on Render
├── client/            the React app
│   └── src/
│       ├── App.tsx        the page layout
│       ├── index.css      colors for light and dark
│       ├── lib/           connection to the server, helpers
│       ├── hooks/         chat logic, connection status, Live Wire, theme
│       ├── components/    the pieces of the page
│       └── assets/art/    put a wallpaper.jpg here to change the chat background
├── public-legacy/     the first version of the front end (plain HTML/JS), not used anymore
├── docs/
│   ├── ARCHITECTURE.md    how it works inside
│   └── TESTING.md         things to check by hand after a change
└── CHANGELOG.md       what changed in each version
```

## Changing the chat background

The background behind the messages is drawn by code. If you want a picture instead, save it as `client/src/assets/art/wallpaper.jpg` and rebuild. It's shown very faded so the text stays readable. Delete the file to get the drawn one back.

## How it works, short version

Each browser tab opens one connection to the server. When you join, the server puts your connection in a room with your name. Messages and typing for you go to that room.

The first time you use a name, the server gives your browser a secret token, saved in localStorage. To use that name again later, the browser has to send the same token. That's how nobody else can take your name while you're away.

The server never logs what a message says, only who sent it to whom and how long it was.

More details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Socket events

These are the messages that go between the browser and the server. The types for them are in `client/src/lib/socket.ts`.

Browser to server:

| Event          | Sends              | Gets back                                            | What for                    |
|----------------|--------------------|------------------------------------------------------|-----------------------------|
| `register`     | `{ name, token? }` | `{ ok, me, token, users, history }` or `{ ok:false, error }` | join, or log back in    |
| `message:send` | `{ to, text }`     | `{ ok, message }` or `{ ok:false, error }`            | send a message              |
| `message:read` | `{ peer }`         | nothing                                              | I've seen what `peer` sent me |
| `typing`       | `{ to, isTyping }` | nothing                                              | started / stopped typing    |

Server to browser:

| Event          | Sends                                     | Goes to             | Means                        |
|----------------|-------------------------------------------|---------------------|------------------------------|
| `server:logs`  | list of log lines                         | the tab that just connected | what happened so far |
| `server:log`   | `{ time, level, text, meta? }`            | everyone            | something just happened      |
| `user:new`     | `{ name, online, lastSeen }`              | everyone else       | a new person joined          |
| `user:online`  | `{ name, online, lastSeen }`              | everyone else       | someone came online          |
| `user:offline` | `{ name, online, lastSeen }`              | everyone            | someone left                 |
| `message:new`  | `{ id, from, to, text, time, delivered, status }` | the person it's for | you got a message    |
| `message:status` | `{ ids, status }`                       | the person who sent those messages | your messages were delivered or read |
| `typing`       | `{ from, isTyping }`                      | the person it's for | someone is typing to you     |

A message's `status` is `sent` (the server has it, the other person is offline), `delivered` (it's in their browser) or `read` (they opened the chat). It only goes forward. The browser sends `message:read` when you open a chat, when a message comes into the chat you have open, and when you come back to the tab. Never while the tab is in the background. The server takes "who read it" from the connection, not from the payload, so you can't mark someone else's messages as read.

`meta` on a log line says what it was about: `type` (message, typing, presence, register or system) and who (`from`, `to`). Live Wire uses it to draw the dots.

## Good to know

- Restarting the server deletes all users and messages.
- Only the last 1000 messages are kept.
- At most 200 names (change it with the `MAX_USERS` environment variable). After that new names get "The server is full right now". People who already have a name can still log back in.
- One tab per name at a time.
- Live Wire shows everyone who is talking to whom (never the text). Fine for a demo, but you wouldn't do that in a real messenger.
- Fonts come from Google Fonts, so the page needs internet for them.

## Maybe later

- [ ] Save things in a database
- [x] Read receipts (2.1.0)
- [ ] Group chats
- [ ] Real login with a password
- [ ] Automatic tests

## Changes

See [CHANGELOG.md](CHANGELOG.md).
