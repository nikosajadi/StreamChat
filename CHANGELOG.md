# Changelog

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
