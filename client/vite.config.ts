// ===========================================================================
// Vite config for the StreamChat React client.
// ---------------------------------------------------------------------------
// Dev:  `npm run dev` serves the app on http://localhost:5173 and proxies
//       /socket.io (HTTP long-polling AND WebSocket) to the Node server on
//       port 3000, so the browser talks to one origin and no CORS is needed.
// Prod: `npm run build` writes static files to client/dist, which server.js
//       serves directly.
//
// The backend address can be changed with STREAMCHAT_API, e.g. when the
// server runs on another port:  STREAMCHAT_API=http://localhost:3001 npm run dev
// ===========================================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.STREAMCHAT_API ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/socket.io': {
        target: API,
        ws: true, // forward the WebSocket upgrade too
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
