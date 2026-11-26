# Manual tests

There are no automated tests yet, so this is the list I go through by hand after changing something. Each test says what to do and what you should see. Most of them need two browser tabs.

Start it in dev mode (two terminals):

```bash
npm run dev:server
npm run dev:client
```

Then open http://localhost:5173. To test the production build instead, run `npm run build` and `npm start` and open http://localhost:3000.

Some tests use the browser console (F12). The React app doesn't put `io` on the page, so those tests load it from the server first with:

```js
const { io } = await import('/socket.io/socket.io.esm.min.js');
```

---

## 1. Basic flow

1. Open two tabs. Join as `Alice` in one and `Bob` in the other.
2. Alice should see Bob pop up in her contact list, and the other way around. In Live Wire, Bob's node shows up with an indigo ring.
3. Send a message from Bob to Alice. It should show up for Alice right away, with an unread badge if her chat with Bob isn't open.
4. Close Bob's tab. Alice should see Bob go offline ("last seen just now").
5. In the Live Wire log the message line should look like `Message #1 "Bob" → "Alice" (delivered), 5 chars`. The text itself should not be there.

## 2. Typing indicator

1. Alice and Bob both open the chat with each other.
2. Bob starts typing. Alice should see "typing…" under Bob's name and the three dots in the chat.
3. Bob stops typing for about 1.5 seconds. The indicator on Alice's side goes away.

## 3. Closing the tab while typing (fixed in 1.0.2)

Used to be: if someone closed the tab in the middle of typing, the server never told the other side they stopped.

1. Alice and Bob in the same chat.
2. Bob types a few letters and closes the tab right away with Ctrl+W (within 1.5 seconds, otherwise the normal "stopped typing" goes out first and you won't hit this case).
3. Look at the Live Wire log on Alice's side. You should see this line before "User offline":

```
TYPING "Bob" stopped typing to "Alice" (disconnected)
```

## 4. Bad ack from a client (fixed in 1.0.2)

Used to be: if a client sent something that wasn't a function as the callback, the whole server crashed with `TypeError: ack is not a function`.

1. Open a tab, no need to log in.
2. Press F12 and go to Console.
3. Paste this and press Enter:

```js
const { io } = await import('/socket.io/socket.io.esm.min.js');
const s = io({ forceNew: true }); s.on('connect', () => s.emit('register', { name: 'Hacker' }, 123));
```

4. The server should stay up. No error in the terminal, `Hacker` shows up in the contact list of other tabs, and the log says `New user registered: "Hacker"`.

## 5. Registering twice on the same socket (fixed in 1.0.1)

Used to be: one socket could register as two names. The first name then stayed "online" forever and the socket kept getting that user's messages.

1. Open a tab, F12, Console.
2. Paste this:

```js
const { io } = await import('/socket.io/socket.io.esm.min.js');
const s = io({ forceNew: true });
s.on('connect', () => {
  s.emit('register', { name: 'UserA' }, (r) => console.log('first:', r.ok));
  s.emit('register', { name: 'UserB' }, (r) => console.log('second:', r));
});
```

3. You should get `first: true` and then `second: { ok: false, error: 'Already registered.' }`.
4. Close the tab. `UserA` should go offline for everyone else.

## 6. Same name in two tabs

1. Join as `Alice` in one tab.
2. Try to join as `Alice` in another tab.
3. You should get "This name is already online." under the name field and as a toast in the corner.

## 7. Logging back in and stealing a name (added in 1.1.0)

1. Join as `Alice` in a tab, send a message to someone, then close the tab.
2. Open a new tab in the same browser and join as `Alice` again. You should get in and see your old messages.
3. Reload that tab. It should log you back in as `Alice` by itself, without the register screen.
4. Close it again. Now open a private / incognito window (it has its own empty localStorage) and try to join as `Alice`.
5. You should get "This name is already taken." and the log shows `wrong or missing token for "Alice"`.

## 8. Messaging yourself (added in 1.1.0)

1. Join as `Alice`. You shouldn't see yourself in the contact list.
2. F12, Console:

```js
const { io } = await import('/socket.io/socket.io.esm.min.js');
const s = io({ forceNew: true });
s.on('connect', () => s.emit('register', { name: 'Solo' }, () =>
  s.emit('message:send', { to: 'Solo', text: 'hi' }, (r) => console.log(r))));
```

3. You should get `{ ok: false, error: 'You cannot message yourself.' }`.

## 9. HTML in names and messages

1. Join with the name `<b>test</b>` in one tab, and with `<img src=x onerror=alert(1)>` in another.
2. Send a message like `<i>hi</i> <script>alert(1)</script>`.
3. No alert should pop up and nothing should be bold or italic. Names and text show exactly as typed: in the contact list, chat header, bubbles, Live Wire node labels and log. The avatar letter should be `<`.

## 10. Emoji picker (added in 1.2.0)

1. Alice and Bob in the same chat.
2. Bob clicks the smiley next to the message box. A panel with emoji opens above it.
3. Click two or three emoji. They should go into the message box at the cursor, and the panel stays open. Alice should see "typing…".
4. Press Enter. The panel closes and Alice gets the emoji big, without a bubble.
5. Send `Nice one 👍 see you later`. That one should be a normal bubble.
6. Open the panel and check it closes with Escape, by clicking outside it, and by clicking the smiley again.

## 11. Live Wire (added in 2.0.0)

1. Three tabs: Alice, Bob, Cleo, on a wide window (1024px or more). Live Wire is the right column.
2. The diagram shows the server in the middle and all three around it. You are marked "(you)".
3. Bob sends Alice a message: a terracotta dot goes Bob → server → Alice. Typing makes a smaller grey dot.
4. Close Cleo's tab: an indigo ring on Cleo, and Cleo's node fades.
5. Click the filter chips. Each one shows only its kind of line.
6. Click Pause, send a few messages. The list doesn't change but the button counts new lines. Resume shows them.
7. Turn on "reduce motion" in your OS. Reload. No dots move, the nodes just get a colored ring when something happens.

## 12. Themes

1. First visit follows the system light/dark setting.
2. Click the moon/sun in the top bar. The theme changes everywhere, including Live Wire and the background art.
3. Reload. It stays on the theme you picked.

## 13. Phone and tablet sizes

1. Open dev tools and switch to a 375px wide phone.
2. You see only the contact list. Tap a contact: the chat opens full screen with a back arrow.
3. Tap the Live Wire button in the top bar: it slides up as a bottom sheet. Escape or tapping outside closes it.
4. At 768px (tablet) both contacts and chat are visible, and Live Wire slides in from the right.

## 14. Connection status

1. Logged in, stop the server (Ctrl+C).
2. The top bar says "Reconnecting", a banner shows above the message box, and the box is disabled.
3. Start the server again. It goes back to "Connected" and you're logged back in by itself (names are free again after a restart, so you get a new token).

## 15. Server restart

1. Have Alice and Bob logged in.
2. Stop the server (Ctrl+C) and start it again.
3. Both tabs should show "disconnected" and then log back in by themselves. Old messages are gone because everything is kept in memory.

## 16. Ticks (added in 2.1.0)

The ticks are next to the time under your own last message. Hover one to see "Sent", "Delivered" or "Read".

1. Join as Bob, then close his tab. Join as Alice and send Bob a message. One grey tick.
2. Open a new tab and join as Bob again. On Alice's side it turns into two grey ticks. The log says `Delivered 1 stored message(s) "Alice" → "Bob"`.
3. Bob opens the chat with Alice. Two terracotta ticks on Alice's side, and the log says `"Bob" read 1 message(s) from "Alice"`.
4. With Bob's chat with Alice still open, Alice sends another one. It goes straight to terracotta.
5. Bob opens a chat with someone else. Alice sends again: two grey ticks. Bob goes back to Alice's chat: terracotta.
6. Bob keeps Alice's chat open and switches to another browser tab (or minimizes the window). Alice sends: it stays grey. Bob comes back to the tab: terracotta.
7. Console, check nobody can fake a read:

```js
const { io } = await import('/socket.io/socket.io.esm.min.js');
const s = io({ forceNew: true });
s.on('connect', () => s.emit('register', { name: 'Faker' }, () => {
  s.emit('message:read', { peer: 'Faker' });
  s.emit('message:read', { peer: 'Nobody' });
  s.emit('message:read', 42);
}));
```

No new log lines, no error in the terminal, and no ticks change for anyone.

## 17. Name limit (added in 2.1.1)

1. Start the server with a tiny limit. PowerShell: `$env:MAX_USERS=2; npm start` (bash: `MAX_USERS=2 npm start`).
2. Join as `A` in one tab and `B` in another.
3. Try `C` in a third tab. You should get "The server is full right now. Try again later."
4. Close A's tab and log back in as `A` in the same browser. That still works, because A already has a name.
5. In the log, the "Socket connected" lines should have no IP address.

## 18. Online build (added in 2.1.1)

Before pushing something that changes the build, check that the Render build works from a clean copy:

1. Clone the repo into a new folder (so there's no `node_modules` or `client/dist`).
2. Run `npm run build:deploy` and then `npm start`.
3. http://localhost:3000 should open the app.
