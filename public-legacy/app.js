// ===========================================================================
// StreamChat - public/app.js (client)
// ---------------------------------------------------------------------------
// Runs in the browser. Connects to the Socket.IO server, handles login
// (and keeps each name's token in localStorage), renders the contact list
// and chat view, sends messages and typing events, runs the emoji picker,
// and shows the live "Server & Socket Log" panel.
//
// All user data (names, messages, log text) is put on the page with
// textContent / createTextNode. There's no innerHTML in this file.
//
// The whole file is wrapped in an IIFE so nothing leaks into the global scope.
// ===========================================================================
(() => {
  // Shortcut for document.getElementById.
  const $ = (id) => document.getElementById(id);

  // Open the socket immediately. The server starts sending log entries right
  // away, even before the user has registered a name.
  const socket = io({ autoConnect: true });

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  let me = null;                   // my registered name (null until login)
  let activePeer = null;           // name of the contact whose chat is open
  const contacts = new Map();      // name -> { name, online, lastSeen }
  const conversations = new Map(); // peer name -> [messages], in time order
  const unread = new Map();        // peer name -> unread message count
  const typingFrom = new Set();    // names currently typing to me
  const typingTimers = new Map();  // name -> safety timeout that clears "typing…"

  // Prefill the login box with the last name used in this tab (if any).
  try { $('nameInput').value = sessionStorage.getItem('streamchat:name') || ''; } catch { /* storage blocked */ }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  // Avatar background colors. Each name always maps to the same color.
  const PALETTE = ['#6c8cff', '#8a6cff', '#ff7ab6', '#ff9f5a', '#3ddc97', '#33c3f0', '#e36cff', '#f5b74f'];

  // Simple string hash -> palette index, so colors are stable per name.
  function colorFor(name) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  // Draws an avatar: first letter + colored circle.
  // If `online` is given, also shows a presence dot (green = online).
  function paintAvatar(el, name, online) {
    el.textContent = name.slice(0, 1).toUpperCase();
    el.style.background = colorFor(name);
    if (online !== undefined) {
      el.classList.add('dot');
      el.classList.toggle('online', !!online);
    }
  }

  // Formats a timestamp as HH:MM (24h).
  const fmtTime = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Human-friendly presence text: "online" / "last seen 5 min ago" / ...
  function lastSeenText(u) {
    if (u.online) return 'online';
    const diff = Math.floor((Date.now() - u.lastSeen) / 1000);
    if (diff < 60) return 'last seen just now';
    if (diff < 3600) return `last seen ${Math.floor(diff / 60)} min ago`;
    return `last seen at ${fmtTime(u.lastSeen)}`;
  }

  // Creates an element with optional class and text.
  // Uses textContent (never innerHTML) so user text can't inject HTML.
  // Every piece of user data (names, messages, log text) goes through here
  // or through document.createTextNode, so it's always shown as plain text.
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // =========================================================================
  // Component: Log panel (right column)
  // =========================================================================
  const logList = $('logList');

  // Appends one log row: [time] [LEVEL] text.
  // Auto-scrolls only if the user is already near the bottom, so reading
  // older entries isn't interrupted.
  function addLog(entry) {
    const row = el('div', `log ${entry.level}`);
    row.append(
      el('span', 't', new Date(entry.time).toLocaleTimeString('en-GB')),
      el('span', 'lv', entry.level.toUpperCase()),
      document.createTextNode(entry.text)
    );
    const atBottom = logList.scrollHeight - logList.scrollTop - logList.clientHeight < 40;
    logList.append(row);

    // Keep the DOM light: at most 400 rows.
    while (logList.children.length > 400) logList.firstChild.remove();
    if (atBottom) logList.scrollTop = logList.scrollHeight;
  }

  // Logs a client-side event (yellow "CLIENT" level). Not sent to the server.
  const clientLog = (text) => addLog({ time: Date.now(), level: 'client', text });

  // "clear" link empties the panel (local only); ⌘ button shows/hides it.
  $('clearLogs').onclick = () => logList.replaceChildren();
  $('toggleLogs').onclick = () => $('app').classList.toggle('no-logs');

  // =========================================================================
  // Component: Contacts list (left column)
  // =========================================================================

  // Last message exchanged with a peer (or null). Used for the preview line
  // and for sorting.
  function lastMessage(name) {
    const conv = conversations.get(name);
    return conv && conv.length ? conv[conv.length - 1] : null;
  }

  // Rebuilds the whole contact list. Called whenever presence, typing state,
  // unread counts or messages change. The list is small, so a full re-render
  // is simpler than patching individual rows.
  function renderContacts() {
    const q = $('search').value.trim().toLowerCase();
    const list = $('contacts');
    list.replaceChildren();

    // Filter out myself and apply the search box, then sort:
    // online first, then most recent conversation, then alphabetically.
    const sorted = [...contacts.values()]
      .filter((c) => c.name !== me && c.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const la = lastMessage(a.name)?.time || 0;
        const lb = lastMessage(b.name)?.time || 0;
        if (a.online !== b.online) return a.online ? -1 : 1;
        return lb - la || a.name.localeCompare(b.name);
      });

    // Empty state.
    if (!sorted.length) {
      list.append(el('li', 'section-title', q ? 'No match' : 'No other users yet. Open another tab!'));
    }

    // One <li> per contact: avatar + name + sub-line (+ unread badge).
    for (const c of sorted) {
      const li = el('li', 'contact' + (c.name === activePeer ? ' active' : ''));
      li.dataset.name = c.name;
      const av = el('div', 'avatar');
      paintAvatar(av, c.name, c.online);

      const info = el('div', 'info');
      info.append(el('div', 'name', c.name));

      // Sub-line priority: "typing…" > last message preview > presence text.
      let sub;
      if (typingFrom.has(c.name)) {
        sub = el('div', 'sub typing', 'typing…');
      } else {
        const lm = lastMessage(c.name);
        sub = el('div', 'sub', lm ? (lm.from === me ? 'You: ' : '') + lm.text : lastSeenText(c));
      }
      info.append(sub);
      li.append(av, info);

      // Unread badge.
      const n = unread.get(c.name) || 0;
      if (n) li.append(el('span', 'badge', n));

      li.onclick = () => openChat(c.name);
      list.append(li);
    }

    // Header counter, e.g. "· 2/3 online".
    const others = [...contacts.values()].filter((c) => c.name !== me);
    $('onlineCount').textContent = `· ${others.filter((c) => c.online).length}/${others.length} online`;
  }
  $('search').oninput = renderContacts;

  // Briefly highlights a contact row (new user / new message).
  // Removing the class + forcing reflow lets the animation restart.
  function flashContact(name) {
    const li = document.querySelector(`.contact[data-name="${CSS.escape(name)}"]`);
    if (li) { li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash'); }
  }

  // =========================================================================
  // Component: Chat view (center column)
  // =========================================================================

  // Opens the conversation with `name`: clears its unread count, shows the
  // chat panel, and renders header + messages.
  function openChat(name) {
    activePeer = name;
    unread.delete(name);
    closeEmojiPanel();
    $('emptyChat').classList.add('hidden');
    $('chatView').classList.remove('hidden');
    renderHeader();
    renderMessages();
    renderContacts();
    $('msgInput').focus();
  }

  // Chat header: peer avatar, name and status ("typing…" / online / last seen).
  function renderHeader() {
    if (!activePeer) return;
    const c = contacts.get(activePeer);
    paintAvatar($('peerAvatar'), c.name, c.online);
    $('peerName').textContent = c.name;
    const st = $('peerStatus');
    if (typingFrom.has(c.name)) {
      st.textContent = 'typing…';
      st.className = 'peer-status typing';
    } else {
      st.textContent = lastSeenText(c);
      st.className = 'peer-status' + (c.online ? ' online' : '');
    }
  }

  // Full re-render of the message area for the active peer.
  function renderMessages() {
    const box = $('messages');
    box.replaceChildren();
    const conv = conversations.get(activePeer) || [];
    if (!conv.length) box.append(el('div', 'day-sep', 'No messages yet. Say hi 👋'));
    for (const m of conv) box.append(bubble(m));
    if (typingFrom.has(activePeer)) box.append(typingBubble());
    box.scrollTop = box.scrollHeight;
  }

  // One message bubble. "out" = sent by me (right, gradient), "in" = received.
  // A message that's only 1-3 emoji gets the "big-emoji" class: shown large
  // with no bubble background, like a small sticker.
  function bubble(m) {
    const b = el('div', 'bubble ' + (m.from === me ? 'out' : 'in'));
    if (isBigEmoji(m.text)) b.classList.add('big-emoji');
    b.append(document.createTextNode(m.text));
    b.append(el('div', 'meta', fmtTime(m.time)));
    return b;
  }

  // Animated three-dot bubble shown while the peer is typing.
  function typingBubble() {
    const t = el('div', 'typing-bubble');
    t.id = 'typingBubble';
    t.append(el('span'), el('span'), el('span'));
    return t;
  }

  // Adds a message (incoming or my own) to state and updates the UI.
  // - If the conversation is open, append the bubble (above the typing dots).
  // - Otherwise, for incoming messages, bump the unread counter.
  function addMessage(m) {
    const peer = m.from === me ? m.to : m.from;
    if (!conversations.has(peer)) conversations.set(peer, []);
    conversations.get(peer).push(m);

    if (peer === activePeer) {
      const box = $('messages');

      // Remove the "No messages yet" placeholder on the first message.
      const empty = box.querySelector('.day-sep');
      if (empty && conversations.get(peer).length === 1) empty.remove();

      // Insert before the typing bubble so the dots stay at the bottom.
      const tb = $('typingBubble');
      box.insertBefore(bubble(m), tb || null);
      box.scrollTop = box.scrollHeight;
    } else if (m.from !== me) {
      unread.set(peer, (unread.get(peer) || 0) + 1);
    }
    renderContacts();
    if (m.from !== me) flashContact(peer);
  }

  // =========================================================================
  // Component: Composer (message input) + outgoing typing events
  // =========================================================================

  // To avoid flooding the server we send `typing:true` only ONCE when typing
  // starts, and `typing:false` once when it stops.
  let typingSentTo = null;     // peer we last told "I'm typing" (null = not typing)
  let stopTypingTimer = null;  // debounce timer that sends `typing:false`

  // Emits a typing state change, skipping duplicates.
  function sendTyping(isTyping) {
    if (!activePeer) return;
    if (isTyping && typingSentTo === activePeer) return; // already announced
    if (!isTyping && !typingSentTo) return;              // already stopped
    const to = isTyping ? activePeer : typingSentTo;
    socket.emit('typing', { to, isTyping });
    typingSentTo = isTyping ? activePeer : null;
  }

  // On each keystroke: announce typing and (re)start a 1.5s idle timer.
  // Clearing the input immediately sends "stopped typing".
  $('msgInput').addEventListener('input', () => {
    if ($('msgInput').value.trim()) {
      sendTyping(true);
      clearTimeout(stopTypingTimer);
      stopTypingTimer = setTimeout(() => sendTyping(false), 1500);
    } else {
      sendTyping(false);
    }
  });

  // Leaving the input also counts as "stopped typing".
  $('msgInput').addEventListener('blur', () => sendTyping(false));

  // Send a message. The bubble is rendered only after the server confirms it
  // (ack), so what you see is exactly what was stored.
  $('composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('msgInput').value.trim();
    if (!text || !activePeer) return;
    clearTimeout(stopTypingTimer);
    sendTyping(false);
    socket.emit('message:send', { to: activePeer, text }, (res) => {
      if (res.ok) addMessage(res.message);
      else clientLog(`Send failed: ${res.error}`);
    });
    $('msgInput').value = '';
    closeEmojiPanel();
  });

  // =========================================================================
  // Component: Emoji picker
  // =========================================================================
  // The smiley button next to the input opens a panel of emoji grouped by
  // category. Clicking one inserts it at the cursor in the message box; the
  // user can pick several and then send as usual. The panel is built once,
  // the first time it opens. Closes on: second click on the button, Escape,
  // click outside, sending, or switching chats.

  // Emoji list, grouped. Each string is split on spaces.
  const EMOJI_GROUPS = [
    ['Smileys', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😌 😍 🥰 😘 😋 😛 😜 🤪 😎 🤩 🥳 😏 😒 😔 😢 😭 😤 😠 😡 🤯 😳 😱 😨 🤔 🤫 🤭 🙄 😴 🤒 🤧 😷 🤠 🤡 👻 💀 🤖'],
    ['Gestures', '👍 👎 👌 ✌️ 🤞 🤟 🤘 👋 🤙 👏 🙌 🙏 🤝 💪 👀 👆 👇 👉 👈 ✋'],
    ['Hearts', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💞 💖 💘 💯 ✨ 🔥 ⭐ 🌟 💥 🎉'],
    ['Animals', '🐶 🐱 🐭 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦄 🐝 🦋'],
    ['Food', '🍎 🍊 🍋 🍉 🍇 🍓 🍒 🍑 🍍 🥑 🍕 🍔 🍟 🌭 🌮 🍿 🍩 🍪 🎂 ☕'],
    ['Things', '⚽ 🏀 🎮 🎧 🎵 📱 💻 📷 🎁 🎈 📚 ✏️ 💡 🔑 🚀 ✈️ 🚗 🏠 ⏰ ✅'],
  ];

  const emojiBtn = $('emojiBtn');
  const emojiPanel = $('emojiPanel');
  let emojiBuilt = false;

  // Fills the panel with a title + grid of emoji buttons per group.
  // Emoji are set with textContent like everything else.
  function buildEmojiPanel() {
    for (const [title, list] of EMOJI_GROUPS) {
      const grid = el('div', 'emoji-grid');
      for (const emoji of list.split(' ')) {
        const btn = el('button', '', emoji);
        btn.type = 'button';           // don't submit the form
        btn.title = emoji;
        // mousedown + preventDefault keeps focus in the message box, so the
        // cursor position is kept and no "stopped typing" fires on blur.
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => insertEmoji(emoji));
        grid.append(btn);
      }
      emojiPanel.append(el('div', 'emoji-group', title), grid);
    }
    emojiBuilt = true;
  }

  function openEmojiPanel() {
    if (!emojiBuilt) buildEmojiPanel();
    emojiPanel.classList.remove('hidden');
    emojiBtn.classList.add('open');
    emojiBtn.setAttribute('aria-expanded', 'true');
  }

  function closeEmojiPanel() {
    emojiPanel.classList.add('hidden');
    emojiBtn.classList.remove('open');
    emojiBtn.setAttribute('aria-expanded', 'false');
  }

  // Puts the emoji where the cursor is (or replaces the selected text),
  // moves the cursor after it, and fires an "input" event so the normal
  // typing indicator logic runs.
  function insertEmoji(emoji) {
    const input = $('msgInput');
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
    const caret = start + emoji.length;
    input.focus();
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input'));
  }

  // Button toggles the panel. Same mousedown trick to keep input focus.
  emojiBtn.addEventListener('mousedown', (e) => e.preventDefault());
  emojiBtn.addEventListener('click', () => {
    if (emojiPanel.classList.contains('hidden')) openEmojiPanel();
    else closeEmojiPanel();
    $('msgInput').focus();
  });

  // Click anywhere outside the panel and the button closes it.
  document.addEventListener('click', (e) => {
    if (!emojiPanel.contains(e.target) && !emojiBtn.contains(e.target)) closeEmojiPanel();
  });

  // Escape closes it too.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEmojiPanel();
  });

  // True if the text is only emoji (ignoring spaces) and at most 3 of them.
  // Intl.Segmenter counts what you see as one emoji (e.g. ❤️ or 👍🏽)
  // as one, even when it's made of several code points.
  const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️|\s)+$/u;
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
  function isBigEmoji(text) {
    if (!EMOJI_ONLY.test(text)) return false;
    const compact = text.replace(/\s/g, '');
    const count = segmenter ? [...segmenter.segment(compact)].length : [...compact].length;
    return count >= 1 && count <= 3;
  }

  // =========================================================================
  // Component: Login
  // =========================================================================

  // ---- Session token storage ----
  // The server gives each name a secret token the first time it's
  // registered. We keep it in localStorage under "streamchat:token:<name>"
  // and send it on every register, so only this browser can log back in
  // with that name. Storage can throw (private mode, disabled storage),
  // so every access is wrapped in try/catch and failures are ignored.
  const tokenKey = (name) => `streamchat:token:${name}`;

  // Same cleanup the server does on names (trim, single spaces, 24 chars),
  // so the storage key matches the name the server actually uses.
  const normName = (raw) => String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 24);

  function loadToken(name) {
    try { return localStorage.getItem(tokenKey(normName(name))) || undefined; }
    catch { return undefined; }
  }

  function saveToken(name, token) {
    if (!token) return;
    try { localStorage.setItem(tokenKey(name), token); } catch { /* ignore */ }
  }

  // Calls the server's `register` hub method (with our saved token, if any).
  // On success it saves the token, loads the contact list and chat history
  // from the ack, then switches from login to the app.
  // `onDone(error|null)` reports the result back to the caller.
  function register(name, onDone) {
    socket.emit('register', { name, token: loadToken(name) }, (res) => {
      if (!res.ok) return onDone && onDone(res.error);
      me = res.me;
      saveToken(me, res.token);
      try { sessionStorage.setItem('streamchat:name', me); } catch { /* ignore */ }

      // Replace local contacts with the server's list.
      contacts.clear();
      res.users.forEach((u) => contacts.set(u.name, u));

      // Rebuild conversations from history, grouped by the other party.
      conversations.clear();
      res.history.forEach((m) => {
        const peer = m.from === me ? m.to : m.from;
        if (!conversations.has(peer)) conversations.set(peer, []);
        conversations.get(peer).push(m);
      });

      // Swap screens and fill in "my" header.
      $('login').classList.add('hidden');
      $('app').classList.remove('hidden');
      paintAvatar($('meAvatar'), me, true);
      $('meName').textContent = me;
      document.title = `StreamChat · ${me}`;
      renderContacts();

      // After a reconnect, re-open the chat that was open before.
      if (activePeer) openChat(activePeer);
      onDone && onDone(null);
    });
  }

  // Login form submit -> register with the typed name.
  $('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('nameInput').value.trim();
    if (!name) return ($('loginError').textContent = 'Please enter a name.');
    register(name, (err) => ($('loginError').textContent = err || ''));
  });

  // =========================================================================
  // Socket event listeners (server -> client)
  // =========================================================================

  // Connected (first time or after a reconnect).
  socket.on('connect', () => {
    $('connState').textContent = 'connected';
    $('connState').className = 'conn on';
    clientLog(`Connected to server (socket ${socket.id})`);

    // If we were logged in before (server restart / network drop),
    // register again automatically with the same name.
    if (me) register(me, (err) => err && clientLog(`Re-register failed: ${err}`));
  });

  // Lost connection. Socket.IO will retry automatically.
  socket.on('disconnect', (reason) => {
    $('connState').textContent = 'disconnected';
    $('connState').className = 'conn off';
    clientLog(`Disconnected from server: ${reason}`);
  });

  // Log history (sent once on connect) and live log entries.
  socket.on('server:logs', (entries) => {
    logList.replaceChildren();
    entries.forEach(addLog);
  });
  socket.on('server:log', addLog);

  // A brand-new user registered -> add to contacts and highlight.
  socket.on('user:new', (u) => {
    contacts.set(u.name, u);
    renderContacts();
    flashContact(u.name);
  });

  // A user came online -> update presence dot / header.
  socket.on('user:online', (u) => {
    contacts.set(u.name, u);
    renderContacts();
    if (u.name === activePeer) renderHeader();
  });

  // A user went offline -> update presence and drop any stale "typing…".
  socket.on('user:offline', (u) => {
    contacts.set(u.name, u);
    clearTyping(u.name);
    renderContacts();
    if (u.name === activePeer) renderHeader();
  });

  // Incoming message. A message arriving means the sender stopped typing.
  socket.on('message:new', (m) => {
    clearTyping(m.from);
    addMessage(m);
  });

  // Removes the "typing…" state for a user everywhere it is shown.
  function clearTyping(name) {
    if (!typingFrom.delete(name)) return; // wasn't typing -> nothing to do
    clearTimeout(typingTimers.get(name));
    if (name === activePeer) {
      $('typingBubble')?.remove();
      renderHeader();
    }
    renderContacts();
  }

  // Someone started/stopped typing to me.
  // A 5s safety timeout clears the indicator in case the "stop" event is lost.
  socket.on('typing', ({ from, isTyping }) => {
    if (!isTyping) return clearTyping(from);
    const wasTyping = typingFrom.has(from);
    typingFrom.add(from);
    clearTimeout(typingTimers.get(from));
    typingTimers.set(from, setTimeout(() => clearTyping(from), 5000));

    // Only touch the DOM on the transition not-typing -> typing.
    if (!wasTyping) {
      if (from === activePeer) {
        const box = $('messages');
        box.append(typingBubble());
        box.scrollTop = box.scrollHeight;
        renderHeader();
      }
      renderContacts();
    }
  });

  // Refresh "last seen X min ago" labels every 30 seconds.
  setInterval(() => {
    if (!me) return;
    renderContacts();
    renderHeader();
  }, 30000);
})();
