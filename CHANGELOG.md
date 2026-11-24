# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.2] — 2026-11-24

### Fixed
- **Stuck typing indicator:** if a user closed the tab while typing, the server never sent `isTyping: false`. The server now tracks open typing states per socket and sends `typing { isTyping: false }` to every affected recipient on `disconnect`.
- **Possible crash on invalid ack:** the default `ack = () => {}` only covered `undefined`; a client sending a non-function as the last argument made `ack(...)` throw. Handlers now use a `toAck()` helper that always returns a callable function.

## [1.0.1] — 2026-11-24

### Fixed
- A socket that sent `register` a second time (with another name) could leave the first user permanently "online" and keep receiving that user's messages through the old `user:<name>` room. The server now rejects any `register` on a socket that is already registered (`{ ok: false, error: 'Already registered.' }`) and logs a warning.

## [1.0.0] — 2026-11-24

### Added
- Express + Socket.IO server with in-memory state for users, messages and logs.
- Hub methods: `register`, `message:send`, `typing`, plus `disconnect` handling.
- Presence broadcasting: `user:new`, `user:online`, `user:offline`.
- Central `log()` function: colored terminal output and live `server:log` stream to all clients.
- Dark, minimal messenger client: login, contact list, chat view, composer.
- Typing indicator (header, contact list and animated bubble), unread badges, contact search, last-seen labels.
- Live **Server & Socket Log** panel with level colors, clear and toggle buttons.
- Automatic re-registration after reconnect.
- Detailed English comments across all source files.
- Project documentation: `README.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`.
