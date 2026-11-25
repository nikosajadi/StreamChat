# StreamChat client

React + TypeScript + Vite front end for the StreamChat server in the folder above. See the main [README](../README.md) for how to run everything.

Quick version, from this folder:

```bash
npm install
npm run dev        # http://localhost:5173, proxies /socket.io to :3000
npm run build      # writes dist/, which server.js serves in production
npm run typecheck  # strict TypeScript check, no output files
```

Where to look:

- `src/lib/socket.ts`: the one socket, and the typed event list. Keep it in sync with `server.js`.
- `src/hooks/useChat.ts`: users, messages, typing, unread counts, and the register / send flow.
- `src/hooks/useLiveWire.ts`: the event log and the animation queue for the Live Wire diagram.
- `tailwind.config.ts` + `src/index.css`: all colors, fonts and radii. Components only use these names.
- `src/components/ui/ChatBackground.tsx`: the chat background. To use a picture, see `src/assets/art/README.md`.
