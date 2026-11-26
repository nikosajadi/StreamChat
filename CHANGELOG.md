# Changelog

## 2.1.1 (2026-11-26)

Getting it ready to run online as a public demo.

Added:
- `render.yaml` so the app can be put on Render's free plan with New → Blueprint. Every push to `main` deploys again.
- `npm run build:deploy`: installs the server and the client (with dev tools) and builds the client in one go. That's what Render runs.
- `engines` in `package.json` (Node 20 or newer).
- `MAX_USERS` (default 200). Names are never deleted, so without a limit anyone could fill the server's memory with new names. New names past the limit get "The server is full right now. Try again later." Existing names can always log back in.

Changed:
- The "Socket connected" log line no longer has the IP address. The log goes to every tab, so on a public server everyone would see everyone's IP.

## 2.1.0 (2026-11-26)

Added:
- Message ticks (read receipts), like WhatsApp. Under your own messages: one grey tick = the server stored it, two grey = it's in the other person's browser, two terracotta = they opened the chat and saw it. Each one has an aria-label ("Sent", "Delivered", "Read") for screen readers. In a group of bubbles the ticks sit next to the time under the last one.
- Messages have a `status` field: `sent`, `delivered` or `read`. It only goes forward. The old `delivered` boolean is still there so older clients keep working.
- New event `message:read { peer }` (browser to server). Marks everything `peer` sent me as read. "Me" comes from the socket, never from the payload. The browser sends it when you open a chat, when a message arrives in the open chat, and when you come back to the tab, but never while the tab is hidden.
- New event `message:status { ids, status }` (server to browser). Goes only to the room of the person who sent those messages.
- Messages that were waiting for an offline user turn `delivered` when they log back in, and the sender is told.
- Log lines for these: `Delivered N stored message(s) "A" → "B"` and `"B" read N message(s) from "A"`, with meta `{ type: 'message', from, to }`. No message text. A `message:read` that changes nothing isn't logged.

Changed:
- The " · stored" note next to the time is gone, the single tick shows that now.

## 2.0.0 (2026-11-24)

New React client. The server's events and payloads didn't change, so old clients still work against it.

Added:
- `client/`: a new front end with Vite, React 19, TypeScript (strict), Tailwind CSS, framer-motion, lucide-react and socket.io-client.
- "Editorial paper" look: warm paper background with a faint grain, ink text, terracotta and indigo accents, Fraunces / Inter / JetBrains Mono. Two themes, "Paper" and "Night ink", following the system on first visit and remembered after that.
- Blob avatars drawn from the user's name (same name, same avatar), and a generated watercolor-style chat background. Drop a `wallpaper.jpg` in `client/src/assets/art/` to use a picture instead.
- Live Wire panel: the server in the middle and users around it, with dots moving sender → server → receiver for messages (terracotta) and typing (grey), rings for presence (indigo) and warnings (red). Event log under it, newest first, max 200, with filter chips and pause. With "reduce motion" nothing moves, the nodes just get highlighted.
- Grouped bubbles, Today / Yesterday separators, unread counts, typing dots, emoji picker and big emoji.
- Message box: Enter sends, Shift+Enter new line, grows with the text, send button disabled when empty.
- Connection status (Connecting / Connected / Reconnecting / Offline), a banner and a disabled message box while disconnected.
- Errors from the server show up as small toasts.
- Reloading the page logs you back in if the tab has a saved name and token.
- Layouts for desktop (3 columns), tablet (Live Wire slides in) and phone (separate screens, Live Wire as a bottom sheet).
- Accessibility: visible focus, labels on icon buttons, skip link, screen reader announcements for new messages and typing, modal overlays that trap and return focus, colors checked for WCAG AA in both themes.
- Root scripts: `dev:server`, `dev:client`, `client:install`, `build`, `start`.

Changed:
- `log()` in `server.js` takes an optional `meta` object (`type`, `from`, `to`, plus `online` / `isTyping`) and puts it on the log entry. Message, typing, register, online/offline, connect and disconnect logs pass it. No message text or tokens in it.
- `server.js` now serves `client/dist` instead of `public/`. If the client isn't built yet, `/` says to run `npm run build`.
- The old client moved from `public/` to `public-legacy/`. It's kept for reference and isn't served.
- `client/dist/` is ignored by git.

## 1.2.1 (2026-11-24)

- Updated the comments at the top of `server.js`, `app.js` and `index.html` so they mention tokens, the message limit, no message text in logs, and the emoji picker.
- Cleaned up comment wording, and the online/offline log lines now read like `User online: "Alice", online now: 2/3`.

## 1.2.0 (2026-11-24)

Added:
- Emoji picker. There's a smiley button on the left of the message box. Click it and a panel opens with emoji in a few groups (smileys, gestures, hearts, animals, food, things). Clicking one puts it where your cursor is, and you can pick as many as you want before sending. The panel closes when you click the button again, press Escape, click somewhere else, send, or switch chats.
- Messages that are just 1 to 3 emoji show up big without a bubble, kind of like a sticker.
- No server changes. Emoji are just normal text.

## 1.1.0 (2026-11-24)

Added:
- Each name now gets a secret token (`crypto.randomUUID()`) the first time it registers. The browser keeps it in localStorage under `streamchat:token:<name>` and sends it on every register. Coming back to an offline name without the right token gets "This name is already taken." so people can't pretend to be someone else. The token is only ever sent back to its owner, never broadcast.
- Messages array is capped at 1000 (`MESSAGE_LIMIT`). Oldest ones are dropped first, same as the log buffer.
- `docs/TESTING.md` with the manual tests I run after changes.

Changed:
- Message log lines no longer include the text. They only show id, from, to, delivered/stored and length (like "34 chars"). The log goes to every tab, so the old preview leaked private messages to everyone.
- The client no longer uses `innerHTML` at all, not even to clear lists. It uses `replaceChildren()`. User data was already shown with `textContent`.
- Rewrote README, ARCHITECTURE and this file in plainer wording.

Fixed:
- You could send a message to yourself through the socket. Now the server replies "You cannot message yourself."

## 1.0.2 (2026-11-24)

Fixed:
- Typing indicator could get stuck. If someone closed the tab while typing, the server never sent "stopped typing". Now the server keeps track of who each socket is typing to and sends `isTyping: false` to them on disconnect.
- Server could crash from a bad callback. `ack = () => {}` only covers the case where nothing is sent. If a client sent something like a number instead of a function, calling it threw `TypeError: ack is not a function` and took the whole server down. Added a small `toAck()` helper that always gives back a function.

## 1.0.1 (2026-11-24)

Fixed:
- One socket could register twice with two different names. The first name then stayed online forever and the socket kept getting that user's messages through the old room. Now a second `register` on the same socket gets `{ ok: false, error: 'Already registered.' }`.

## 1.0.0 (2026-11-24)

First version:
- Express + Socket.IO server, everything kept in memory.
- Events: `register`, `message:send`, `typing`, plus handling `disconnect`.
- Online / offline updates: `user:new`, `user:online`, `user:offline`.
- One `log()` function that prints to the terminal and sends each line to the browser.
- Dark chat page with login, contacts, chat window and input box.
- Typing indicator, unread count, search, last seen.
- Log panel with colors per level, plus clear and hide buttons.
- Logs back in by itself after a reconnect.
- Comments in all source files.
- README, ARCHITECTURE and CHANGELOG.
