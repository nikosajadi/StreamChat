# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
