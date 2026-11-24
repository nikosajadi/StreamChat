# Manual tests

There are no automated tests yet, so this is the list I go through by hand after changing something. Each test says what to do and what you should see. Most of them need two browser tabs.

Start the server first:

```bash
npm start
```

Then open http://localhost:3000.

---

## 1. Basic flow

1. Open two tabs. Join as `Alice` in one and `Bob` in the other.
2. Alice should see Bob pop up in her contact list (with a short highlight), and the other way around.
3. Send a message from Bob to Alice. It should show up for Alice right away, with an unread badge if her chat with Bob isn't open.
4. Close Bob's tab. Alice should see Bob go offline ("last seen just now").
5. In the log panel the message line should look like `Message #1 "Bob" → "Alice" (delivered), 5 chars`. The text itself should not be there.

## 2. Typing indicator

1. Alice and Bob both open the chat with each other.
2. Bob starts typing. Alice should see "typing…" under Bob's name and the three dots in the chat.
3. Bob stops typing for about 1.5 seconds. The indicator on Alice's side goes away.

## 3. Closing the tab while typing (fixed in 1.0.2)

Used to be: if someone closed the tab in the middle of typing, the server never told the other side they stopped.

1. Alice and Bob in the same chat.
2. Bob types a few letters and closes the tab right away with Ctrl+W (within 1.5 seconds, otherwise the normal "stopped typing" goes out first and you won't hit this case).
3. Look at the log panel on Alice's side. You should see this line before "User offline":

```
TYPING "Bob" stopped typing to "Alice" (disconnected)
```

## 4. Bad ack from a client (fixed in 1.0.2)

Used to be: if a client sent something that wasn't a function as the callback, the whole server crashed with `TypeError: ack is not a function`.

1. Open a tab, no need to log in.
2. Press F12 and go to Console.
3. Paste this and press Enter:

```js
const s = io({ forceNew: true }); s.on('connect', () => s.emit('register', { name: 'Hacker' }, 123));
```

4. The server should stay up. No error in the terminal, `Hacker` shows up in the contact list of other tabs, and the log says `New user registered: "Hacker"`.

## 5. Registering twice on the same socket (fixed in 1.0.1)

Used to be: one socket could register as two names. The first name then stayed "online" forever and the socket kept getting that user's messages.

1. Open a tab, F12, Console.
2. Paste this:

```js
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
3. You should get "This name is already online." on the login screen.

## 7. Logging back in and stealing a name (added in 1.1.0)

1. Join as `Alice` in a tab, send a message to someone, then close the tab.
2. Open a new tab in the same browser and join as `Alice` again. You should get in and see your old messages.
3. Close it again. Now open a private / incognito window (it has its own empty localStorage) and try to join as `Alice`.
4. You should get "This name is already taken." and the log shows `wrong or missing token for "Alice"`.

## 8. Messaging yourself (added in 1.1.0)

1. Join as `Alice`. You shouldn't see yourself in the contact list.
2. F12, Console:

```js
const s = io({ forceNew: true });
s.on('connect', () => s.emit('register', { name: 'Solo' }, () =>
  s.emit('message:send', { to: 'Solo', text: 'hi' }, (r) => console.log(r))));
```

3. You should get `{ ok: false, error: 'You cannot message yourself.' }`.

## 9. HTML in names

1. Join with the name `<img src=x onerror=alert(1)>`.
2. No alert should pop up. The name should show as plain text in your header, and in the contact list and chat header on the other tab. The avatar letter should be `<`.

## 10. Server restart

1. Have Alice and Bob logged in.
2. Stop the server (Ctrl+C) and start it again.
3. Both tabs should show "disconnected" and then log back in by themselves. Old messages are gone because everything is kept in memory.
