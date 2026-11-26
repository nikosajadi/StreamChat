// ===========================================================================
// StreamChat - server.js
// ---------------------------------------------------------------------------
// A small messenger simulator server built with Express + Socket.IO.
//
// What it does:
//   1. Serves the built React client from client/dist (run `npm run build`
//      first). The old plain-JS client is kept in public-legacy/.
//   2. Registers clients by name. Each new name gets a secret token, and
//      logging back in to that name later needs the same token.
//   3. Passes private messages between users in real time. Keeps the last
//      MESSAGE_LIMIT (1000) messages so offline users get them later.
//      Each message has a status (sent / delivered / read) and the sender
//      is told when it changes, for the ticks under their bubbles.
//   4. Forwards "is typing" from one user to another, and clears it if the
//      typing user disconnects.
//   5. Tracks online / offline and tells every client.
//   6. Logs every server/socket event to the console AND to all connected
//      tabs (the "Live Wire" panel). Log entries carry a small `meta`
//      object so clients don't have to parse text. Message text is never
//      logged.
//
// All data is kept in memory. Restarting the server clears everything.
// ===========================================================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
const fs = require('fs');                 // checks that client/dist exists
const path = require('path');             // builds the absolute path to client/dist
const crypto = require('crypto');         // randomUUID() for per-user session tokens
const http = require('http');             // raw HTTP server that Socket.IO attaches to
const express = require('express');       // serves the static client files
const { Server } = require('socket.io');  // real-time WebSocket layer

// Port can be overridden with the PORT environment variable (e.g. PORT=4000).
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------
// Express handles normal HTTP requests; Socket.IO shares the same HTTP server
// so the client can load the page and open a socket on the same port.
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// The React client is built into client/dist (`npm run build`) and served
// as static files. Socket.IO handles /socket.io/* itself on the same port.
// During development you don't need this: Vite serves the client on :5173
// and proxies /socket.io here.
const CLIENT_DIST = path.join(__dirname, 'client', 'dist');
const CLIENT_BUILT = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));

if (CLIENT_BUILT) {
  app.use(express.static(CLIENT_DIST));
} else {
  // No build yet: say what to do instead of a blank 404.
  app.get('/', (_req, res) => {
    res
      .status(503)
      .type('text/plain')
      .send(
        [
          'The client is not built yet.',
          '',
          'Run `npm run build` and restart the server,',
          'or use `npm run dev` for development (http://localhost:5173).',
        ].join('\n')
      );
  });
}

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

// Registered users, keyed by display name.
// Shape: name -> { name, token, socketId|null, online, lastSeen, registeredAt }
//   - token is a secret given to the first owner of the name. Logging back
//     in with that name requires it, so nobody else can take it over.
//     It is never sent to anyone except its owner.
//   - socketId is null while the user is offline.
//   - lastSeen is updated on login and on disconnect.
const users = new Map();

// Recent messages, oldest first. Capped at MESSAGE_LIMIT so memory can't
// grow forever; the oldest ones are dropped first (same idea as logBuffer).
// Shape: { id, from, to, text, time, delivered, status }
//   - status: 'sent'      stored, recipient was offline
//             'delivered' the recipient's browser has it
//             'read'      the recipient opened the chat and saw it
//     It only ever moves forward (sent -> delivered -> read).
//   - delivered is the older boolean, kept so old clients still work.
//     It's true whenever status isn't 'sent'.
const messages = [];
const MESSAGE_LIMIT = 1000;

// Ring buffer of the most recent log entries. A newly connected panel
// receives this buffer so it can show what happened before it joined.
const logBuffer = [];
const LOG_LIMIT = 300;

// Auto-incrementing message id.
let msgSeq = 1;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
// ANSI color codes per log level, used only for the terminal output.
// Levels: info | success | warn | error | msg | typing
const COLORS = { info: 36, success: 32, warn: 33, error: 31, msg: 35, typing: 90 };

// log(level, text, meta?)
// Writes one event to three places:
//   1. logBuffer: so tabs that connect later can see what happened before
//   2. console:   colored line in the terminal running the server
//   3. io.emit:   pushes the entry live to every connected tab
//
// `meta` is optional structured info about the event, so clients (the
// Live Wire panel) don't have to parse the text:
//   { type: 'message' | 'typing' | 'presence' | 'register' | 'system',
//     from?, to?, online?, isTyping? }
// Never put message text or tokens in meta: it goes to every tab.
function log(level, text, meta) {
  const entry = { time: Date.now(), level, text };
  if (meta) entry.meta = meta;

  // Keep the buffer bounded: drop the oldest entry once we exceed the limit.
  logBuffer.push(entry);
  if (logBuffer.length > LOG_LIMIT) logBuffer.shift();

  // Pretty console output: grey timestamp + colored [LEVEL] + message.
  const ts = new Date(entry.time).toLocaleTimeString('en-GB');
  const color = COLORS[level] || 37;
  console.log(`\x1b[90m${ts}\x1b[0m \x1b[${color}m[${level.toUpperCase()}]\x1b[0m ${text}`);

  // Broadcast to all sockets (registered or not) so every log panel updates.
  io.emit('server:log', entry);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Returns only the fields that are safe to send to other clients.
// Never add socketId or token here: this object is broadcast to everyone.
function publicUser(u) {
  return { name: u.name, online: u.online, lastSeen: u.lastSeen };
}

// Full contact list as sent to a client after it registers.
function userList() {
  return [...users.values()].map(publicUser);
}

// All messages a given user sent or received. Used to restore the chat
// history when a user logs back in.
function historyFor(name) {
  return messages.filter((m) => m.from === name || m.to === name);
}

// Normalizes a user-provided name: trims, collapses whitespace and limits
// length to 24 chars. Returns '' for missing/invalid input.
function cleanName(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 24);
}

// Number of users currently online (used in log lines).
function onlineCount() {
  return [...users.values()].filter((u) => u.online).length;
}

// Moves messages to a new status and tells each sender which of theirs
// changed. `list` is the messages to update; ones already at that status
// (or further) are skipped. Returns a Map of sender -> ids that changed,
// so the caller can log it. Never sends message text, only ids.
const STATUS_RANK = { sent: 0, delivered: 1, read: 2 };
function setStatus(list, status) {
  const bySender = new Map();
  for (const m of list) {
    if (STATUS_RANK[m.status] >= STATUS_RANK[status]) continue;
    m.status = status;
    m.delivered = true; // delivered or read both mean the browser has it
    if (!bySender.has(m.from)) bySender.set(m.from, []);
    bySender.get(m.from).push(m.id);
  }
  // Only the original sender cares, so it goes to their room only.
  for (const [sender, ids] of bySender) {
    io.to(`user:${sender}`).emit('message:status', { ids, status });
  }
  return bySender;
}

// Returns a safe acknowledgement callback.
// Socket.IO passes whatever the client sent as the last argument, so `ack`
// may be a number, string, object, or missing. A default parameter
// (`ack = () => {}`) only covers `undefined`; calling a non-function would
// throw. This always returns something callable.
function toAck(ack) {
  return typeof ack === 'function' ? ack : () => {};
}

// ===========================================================================
// Socket.IO hub
// ---------------------------------------------------------------------------
// Each browser tab opens one socket. The handlers below form the "hub API":
//
//   Client -> Server            Server -> Client
//   -----------------           -------------------------------------------
//   register     (ack)          server:logs   (log history, on connect)
//   message:send (ack)          server:log    (one new log entry, to all)
//   message:read                user:new      (a brand-new user registered)
//   typing                      user:online   (a user came online)
//                               user:offline  (a user went offline)
//                               message:new   (incoming message, to recipient)
//                               message:status (your messages were delivered/read)
//                               typing        (someone is typing to you)
// ===========================================================================
io.on('connection', (socket) => {
  // A raw socket connected. It is NOT registered yet (no name).
  const ip = socket.handshake.address;
  log('info', `Socket connected: id=${socket.id} ip=${ip}`, { type: 'system' });

  // Send the recent log history so this panel isn't empty on load.
  socket.emit('server:logs', logBuffer);

  // -------------------------------------------------------------------------
  // Hub method: register
  // -------------------------------------------------------------------------
  // Payload: { name, token? }
  // Ack:     { ok: true, me, token, users, history } | { ok: false, error }
  //
  // - New name                     -> creates the user with a fresh token,
  //                                   broadcasts `user:new`.
  // - Known, offline, right token  -> logs the user back in (keeps history).
  // - Known, offline, wrong token  -> rejected ("This name is already taken.").
  // - Known, online                -> rejected (names are unique while online).
  // In both success cases `user:online` is broadcast to everyone else.
  // A socket can register only ONCE; a second `register` is rejected.
  socket.on('register', (payload, rawAck) => {
    // Always callable, even if the client sent a non-function (see toAck).
    const ack = toAck(rawAck);

    // Guard: this socket already has an identity. Allowing a second register
    // would overwrite socket.data.name, so the first user would never be
    // marked offline on disconnect and the socket would stay in the first
    // user's room (still receiving their messages). Reconnects are not
    // affected, because a reconnect always uses a brand-new socket.
    if (socket.data.name) {
      log('warn', `Registration rejected: socket ${socket.id} is already registered as "${socket.data.name}"`);
      return ack({ ok: false, error: 'Already registered.' });
    }

    const name = cleanName(payload && payload.name);

    // Validation: name must not be empty after cleaning.
    if (!name) {
      log('warn', `Registration rejected (empty name) for socket ${socket.id}`);
      return ack({ ok: false, error: 'Name is required.' });
    }

    // Validation: the same name cannot be online in two tabs at once.
    const existing = users.get(name);
    if (existing && existing.online) {
      log('warn', `Registration rejected: "${name}" is already online (socket ${socket.id})`);
      return ack({ ok: false, error: 'This name is already online.' });
    }

    // Validation: logging back in to an existing (offline) name needs the
    // token that was handed out when the name was first registered.
    // Without this, anyone could type an offline user's name and read
    // their history or send messages as them.
    if (existing && (!payload || payload.token !== existing.token)) {
      log('warn', `Registration rejected: wrong or missing token for "${name}" (socket ${socket.id})`);
      return ack({ ok: false, error: 'This name is already taken.' });
    }

    // Either reuse the existing (offline) record or create a fresh one.
    let isNew = false;
    if (existing) {
      existing.socketId = socket.id;
      existing.online = true;
      existing.lastSeen = Date.now();
    } else {
      isNew = true;
      users.set(name, {
        name,
        token: crypto.randomUUID(), // secret, only ever sent back to this user
        socketId: socket.id,
        online: true,
        lastSeen: Date.now(),
        registeredAt: Date.now(),
      });
    }

    // Remember the name on the socket so later events know who sent them.
    socket.data.name = name;

    // Names of users this socket is currently "typing to". Used on
    // disconnect to send a final `typing:false` so no indicator gets stuck.
    socket.data.typingTo = new Set();

    // Join a personal room "user:<name>". Messages and typing events are sent
    // to this room, so delivery doesn't depend on a specific socket id.
    socket.join(`user:${name}`);

    // Messages that came in while this user was away are now in their
    // browser (they're in the history below), so they count as delivered.
    // Done before the ack so the history already has the new status.
    const waiting = messages.filter((m) => m.to === name && m.status === 'sent');
    for (const [sender, ids] of setStatus(waiting, 'delivered')) {
      log('msg', `Delivered ${ids.length} stored message(s) "${sender}" → "${name}"`, {
        type: 'message',
        from: name,
        to: sender,
      });
    }

    // Reply to the caller with everything it needs to render the UI.
    // The token goes ONLY to this caller (in the ack), never in a broadcast.
    ack({
      ok: true,
      me: name,
      token: users.get(name).token,
      users: userList(),
      history: historyFor(name),
    });

    // Notify everyone else. `user:new` adds a contact; `user:online` flips
    // an existing contact's status dot to green.
    if (isNew) {
      log('success', `New user registered: "${name}" (socket ${socket.id})`, { type: 'register', from: name });
      socket.broadcast.emit('user:new', publicUser(users.get(name)));
    } else {
      log('success', `User logged back in: "${name}" (socket ${socket.id})`, { type: 'register', from: name });
    }
    log('info', `User online: "${name}", online now: ${onlineCount()}/${users.size}`, {
      type: 'presence',
      from: name,
      online: true,
    });
    socket.broadcast.emit('user:online', publicUser(users.get(name)));
  });

  // -------------------------------------------------------------------------
  // Hub method: message:send
  // -------------------------------------------------------------------------
  // Payload: { to, text }
  // Ack:     { ok: true, message } | { ok: false, error }
  //
  // Stores the message and pushes `message:new` to the recipient's room.
  // If the recipient is offline the message is still stored (status 'sent')
  // and will be returned in their history the next time they log in, which
  // turns it into 'delivered'. Online recipients get it as 'delivered' now.
  socket.on('message:send', (payload, rawAck) => {
    // Always callable, even if the client sent a non-function (see toAck).
    const ack = toAck(rawAck);

    const from = socket.data.name;
    const to = cleanName(payload && payload.to);
    const text = String((payload && payload.text) || '').trim().slice(0, 2000); // max 2000 chars

    // Validation: sender must be registered, recipient must exist, text non-empty.
    if (!from) return ack({ ok: false, error: 'Not registered.' });
    if (to === from) return ack({ ok: false, error: 'You cannot message yourself.' });
    if (!users.has(to)) return ack({ ok: false, error: 'Recipient not found.' });
    if (!text) return ack({ ok: false, error: 'Empty message.' });

    // Build and store the message record.
    const recipient = users.get(to);
    const msg = {
      id: msgSeq++,
      from,
      to,
      text,
      time: Date.now(),
      delivered: recipient.online, // true if pushed live, false if only stored
      status: recipient.online ? 'delivered' : 'sent',
    };
    messages.push(msg);

    // Keep the array bounded: drop the oldest message once over the limit.
    if (messages.length > MESSAGE_LIMIT) messages.shift();

    // Push to the recipient (no-op if their room is empty / offline).
    io.to(`user:${to}`).emit('message:new', msg);

    // Confirm to the sender; the sender renders its own bubble from this ack.
    ack({ ok: true, message: msg });

    // Log only metadata, never the message text itself: the log is sent to
    // every connected tab, so logging content would leak private messages.
    log(
      'msg',
      `Message #${msg.id} "${from}" → "${to}" (${recipient.online ? 'delivered' : 'stored, recipient offline'}), ${text.length} chars`,
      { type: 'message', from, to }
    );
  });

  // -------------------------------------------------------------------------
  // Hub method: message:read
  // -------------------------------------------------------------------------
  // Payload: { peer }
  // "I've seen everything `peer` sent me." Marks all messages from peer to
  // me as 'read' and sends `message:status { ids, status: 'read' }` to the
  // peer's room. "Me" always comes from socket.data.name, never from the
  // payload, so nobody can mark someone else's messages as read.
  // The client sends this when it opens a chat and when a new message
  // arrives in the open chat (only while the tab is visible).
  socket.on('message:read', (payload) => {
    const me = socket.data.name;
    const peer = cleanName(payload && payload.peer);

    // Ignore unregistered sockets, unknown users and myself.
    if (!me || peer === me || !users.has(peer)) return;

    const unread = messages.filter((m) => m.from === peer && m.to === me && m.status !== 'read');
    const ids = setStatus(unread, 'read').get(peer);

    // Nothing new was read: stay quiet so the log isn't flooded.
    if (!ids) return;
    log('msg', `"${me}" read ${ids.length} message(s) from "${peer}"`, {
      type: 'message',
      from: me,
      to: peer,
    });
  });

  // -------------------------------------------------------------------------
  // Hub method: typing
  // -------------------------------------------------------------------------
  // Payload: { to, isTyping }
  // Forwards `typing { from, isTyping }` to the recipient only.
  // The client sends isTyping=true once when typing starts and isTyping=false
  // after ~1.5s of inactivity, on blur, or when the message is sent.
  // The server remembers open "typing" states per socket so it can close
  // them itself if the socket disconnects mid-typing.
  socket.on('typing', (payload) => {
    const from = socket.data.name;
    const to = cleanName(payload && payload.to);
    const isTyping = !!(payload && payload.isTyping);

    // Ignore events from unregistered sockets or to unknown users.
    if (!from || !users.has(to)) return;

    // Track the open typing state for this socket (see disconnect handler).
    if (isTyping) socket.data.typingTo.add(to);
    else socket.data.typingTo.delete(to);

    io.to(`user:${to}`).emit('typing', { from, isTyping });
    log('typing', `"${from}" ${isTyping ? 'started' : 'stopped'} typing to "${to}"`, {
      type: 'typing',
      from,
      to,
      isTyping,
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle: disconnect
  // -------------------------------------------------------------------------
  // Fired when the tab closes, the network drops, or the server shuts down.
  // 1. Closes any "typing" indicator this socket left open.
  // 2. Marks the user offline and broadcasts `user:offline` to everyone.
  socket.on('disconnect', (reason) => {
    const name = socket.data.name;
    log('info', `Socket disconnected: id=${socket.id} reason=${reason}`, { type: 'system' });

    // Socket never registered -> nothing else to update.
    if (!name) return;

    // The user may have closed the tab while typing, so the client never got
    // to send `isTyping:false`. Send it on their behalf to every recipient.
    for (const to of socket.data.typingTo) {
      io.to(`user:${to}`).emit('typing', { from: name, isTyping: false });
      log('typing', `"${name}" stopped typing to "${to}" (disconnected)`, {
        type: 'typing',
        from: name,
        to,
        isTyping: false,
      });
    }
    socket.data.typingTo.clear();

    // Only mark offline if THIS socket is still the user's active one
    // (protects against a stale socket disconnecting after a re-login).
    const u = users.get(name);
    if (u && u.socketId === socket.id) {
      u.online = false;
      u.socketId = null;
      u.lastSeen = Date.now();
      io.emit('user:offline', publicUser(u));
      log('warn', `User offline: "${name}", online now: ${onlineCount()}/${users.size}`, {
        type: 'presence',
        from: name,
        online: false,
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  log('success', `StreamChat server listening on http://localhost:${PORT}`, { type: 'system' });
  if (!CLIENT_BUILT) {
    log('warn', 'client/dist not found: run `npm run build` to serve the React client from this port', {
      type: 'system',
    });
  }
});
