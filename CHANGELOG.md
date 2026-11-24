# Changelog

## Unreleased

- Added `docs/TESTING.md` with the manual tests I run after changes.
- Rewrote README, ARCHITECTURE and this file in plainer wording.

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
