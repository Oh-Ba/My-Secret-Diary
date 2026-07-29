# My Secret Diary

A private, offline diary that runs on your PC and on your Pixel. Memos are coloured,
titled, timestamped, and encrypted. One password opens the diary; any memo can also carry
a password of its own.

No server, no account, no build step, no dependencies. Everything stays on the device
you wrote it on.

---

## The one thing to understand first

**The diary lives at a web address, and each address keeps its own separate diary.**

`http://localhost:4173` on your PC and `https://you.github.io/my-secret-diary` on your
phone are two different addresses, so they are two different diaries — same app, separate
memos. That's browser security doing its job, not a bug.

So: **pick one address and use it on both devices.** Follow "Put it on your phone" below,
then use that same URL on the PC too. Even then the memos don't sync — the whole point is
that nothing leaves your device. See "Moving memos between devices".

---

## Every time you restart the PC

**Nothing. Your memos are still there.**

They're written to disk — in the browser's storage for the diary's address — the moment
you stop typing. A restart, a crash, a dead battery, a browser update: none of it touches
them. There's no setup to redo and nothing to reinstall. The only thing you ever type
again is your password, and that's on purpose — it's not stored, so it has to come from you.

Day to day:

- **Installed app (phone or PC):** tap the yellow icon. Type your password. Write.
- **`start.bat` on the PC:** double-click the Desktop shortcut. Type your password. Write.
  A small black console window opens alongside it — that window *is* the diary running.
  Close it when you're done; your memos stay saved.

Three things that *would* lose your memos, none of which happen on their own:

- Chrome → **Clear browsing data** with "Cookies and other site data" ticked. This is the
  real one. It wipes the diary. Untick that box, or accept the loss and keep backups.
- A cleaner tool (CCleaner and friends) doing the same thing on your behalf.
- Writing in **Incognito**, which throws everything away on close by design.

Take a backup now and then and none of that can hurt you: **More → Save backup**.

### Replacing the folder with a newer version

Safe. Your memos aren't in this folder — they're in the browser's storage for the diary's
address. Delete `C:\Work\My-Secret-Diary`, extract the new zip in its place, and everything
you've written is still there when you open it, as long as you open it at the **same
address** as before (`http://localhost:4173` via `start.bat`, or the same hosted URL).

Take a backup first anyway. It costs one click.

---

## A Desktop shortcut

Double-click **`Create-Desktop-Shortcut.bat`** once. You get a **My Secret Diary**
shortcut on the Desktop with the brass keyhole icon, which starts the local server and
opens the diary in one click. Run it again any time to recreate the shortcut.

If you install the app instead (Routes A and B below), Chrome makes its own Desktop
shortcut with the same yellow icon — and it doesn't need the console window at all. That's
the tidier option if you want it on your phone anyway.

---

## Put it on your phone (and your PC) — 10 minutes

Android only installs a web app that's served over HTTPS. Pick either route.

### Route A — Netlify Drop (fastest, no account needed to start)

1. Go to <https://app.netlify.com/drop> on your PC.
2. Drag the whole `My-Secret-Diary` folder onto the page.
3. You get a URL like `https://gentle-otter-12ab.netlify.app`. That's your diary.
4. Open it on your Pixel in Chrome → **⋮ → Add to Home screen**, or take the **Install
   app** prompt. It installs like a normal app: own icon, no browser bar.
5. On the PC, open the same URL in Chrome → the install icon in the address bar, or the
   app's own **More → Install on this device**.

Claim the site with a free Netlify account so the URL doesn't expire, and rename it to
something forgettable.

### Route B — GitHub Pages (free, permanent, yours)

1. Create a repository, e.g. `my-secret-diary`. **Public is fine** — the code isn't the
   secret, your password is. (Pages needs a paid plan for private repos.)
2. From `C:\Work\My-Secret-Diary`:
   ```
   git init
   git add .
   git commit -m "My Secret Diary"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/my-secret-diary.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages** → Source: **Deploy from a branch**, branch `main`, folder
   `/ (root)` → Save.
4. A minute later it's live at `https://YOUR-NAME.github.io/my-secret-diary/`.
5. Install it on the Pixel and the PC as in Route A, steps 4–5.

### Route C — PC only, nothing hosted

Double-click the Desktop shortcut (or **`start.bat`**). It serves the folder at
`http://localhost:4173`, bound to your own machine only — nothing else on the Wi-Fi can
reach it, and nothing ever leaves the PC. This diary is separate from the hosted one, and
your phone can't reach it either.

---

## Once installed

It works with no signal. The app files are cached on first load, so the diary opens on a
plane or with the router unplugged. Nothing is fetched while you write.

**On the phone:** ☰ opens your memos, the app locks itself 30 seconds after you switch
away from it, and **More → Save backup** hands the encrypted file straight to the Android
share sheet — Drive, Files, wherever.

---

## Moving memos between devices

There's no sync, because sync needs a server and a server is a thing that can be breached.
The manual route is two taps:

1. On the device with the memos: **More → Save backup**. You get an encrypted `.json`.
2. Get it to the other device however you like — it's ciphertext, so Drive, email, or a
   USB stick are all fine. Whoever takes it still needs your password.
3. On the other device: **More → Restore backup** → pick the file. It locks, then reopens
   with the password that belongs to that backup.

Restore **replaces** everything on that device. Treat one device as the one you write on
and the other as the one you read on, or you'll overwrite yesterday's work.

---

## Using it

| | |
|---|---|
| **New memo** | "Write a new memo" in the left column (☰ on the phone) |
| **Colour** | The dots at the top of the memo — eight papers |
| **Title** | Type straight onto the memo's first line |
| **Started** | Set once, when the memo is created |
| **Last changed** | Rewritten on every edit — text, title, or colour |
| **Memo password** | "Lock this memo" — a second lock, just for that memo's text |
| **Lock the diary** | Top right, or `Ctrl+Shift+L` |
| **Locks itself** | After 5 idle minutes, or 30 seconds after you switch away |
| **Backup** | More → Save backup |

A memo with its own password shows a folded corner and a wax seal in the list. Its title
and dates stay visible; its text doesn't open until that memo's password is typed.

---

## How safe is this, really?

You asked whether you can put private things in here and feel safe. A straight answer, in
two halves.

**The encryption itself is the strong part.** It's the same construction password managers
use — PBKDF2 to stretch your password, AES-256-GCM to encrypt — run through the browser's
own audited WebCrypto engine, not homemade maths. Nothing invented, nothing clever. If
someone copies your diary file, or your whole hard drive, what they get is noise. There's
no password stored to extract, no hash to crack in the usual sense, and no key sitting
anywhere on disk. Against a nosy family member, a thief who takes the laptop, a repair
shop, a stolen phone, a leaked backup file on Drive — this holds, and holds well.

**The weak parts are not the maths.** In order of how likely they are to actually bite you:

1. **Your password.** This is the whole lock. Guess it and everything else is decoration.
   A short or reused password can be attacked offline at speed on a GPU, whatever the
   iteration count. Use a passphrase of four or five unrelated words — long beats
   complicated — and use it *nowhere else*.
2. **The device.** If something malicious is running on your PC or phone, it can read your
   password as you type it and your memos while they're open. No web app can prevent that;
   nothing in this design helps you there.
3. **Whoever serves the app**, if you host it. See the section above.
4. **Me.** This app is a few hundred lines written for you and tested by me. I checked the
   flows that matter — wrong passwords rejected, tampered data rejected, no plaintext in
   storage, memos surviving lock/unlock — but no independent person has reviewed it, and
   it hasn't lived in the world long enough to have had its edges knocked off. That's a
   real difference between this and Bitwarden or Signal, and it's worth saying plainly.

**So: yes, for private things.** Personal thoughts, a journal, things that are nobody
else's business, notes you'd hate a housemate or a thief to read. That's what it's built
for and it does that job properly.

**Not as your only copy of something you can't lose** — no recovery means no recovery, so
take backups. **And not for something where a well-funded, determined adversary is
specifically hunting you** — not because the crypto is weak, but because at that level the
attack comes through your device or through you, and you'd want tools with audits and a
track record behind them.

For the actual reasons behind each claim, read on.

---

## How the passwords are protected

The short version: **no password is ever stored, anywhere, in any form.** There's no hash
on disk to steal, and no "correct password" value to compare against.

**Key derivation — PBKDF2-HMAC-SHA-256, 310,000 iterations, 16-byte random salt.**
Your password is stretched into a 256-bit key. The iteration count is the OWASP floor and
makes guessing expensive: each attempt costs an attacker the same ~1 second it costs you.
The salt is random per diary and per memo, so no precomputed or rainbow table applies, and
two memos sharing a password still produce different keys.

**Encryption — AES-256-GCM, fresh random 12-byte IV per write.**
Every memo's text and metadata is encrypted before it touches storage. GCM is
*authenticated*: change a single stored byte and decryption fails loudly instead of
quietly returning corrupted text.

**Keys are non-extractable.** They're created through WebCrypto with `extractable: false`,
so the key material can't be read back out by any script — not even by this app's own code.

**Wrong passwords fail by construction.** Unlocking means *attempting a decryption*. A
wrong password derives a wrong key, and GCM's authentication tag rejects it. Nothing is
compared, so there's no comparison to time and nothing to leak.

**Two independent locks.** A memo password derives its own key with its own salt. The
diary key never touches it, so opening the diary doesn't open that memo, and the memo key
alone can't read the rest of the diary.

**Plaintext only exists in memory, only while unlocked.** Locking — by button, by hotkey,
by idling, or by switching away on the phone — drops the keys and every decrypted memo.
Closing the tab does the same.

**Backups are already encrypted.** The exported `.json` is the same ciphertext, safe on a
USB stick or a cloud drive. It still needs the password that made it.

**The service worker can't read your diary.** It caches the app's own files so it works
offline; it has no access to localStorage and makes no other network calls.

### What this does not protect against

Honest limits are part of the design:

- **A forgotten password is final.** No recovery, no reset, no backdoor. That's the point,
  and it applies to you exactly as it applies to anyone else.
- **Whoever serves the app.** If you host it (Routes A and B), that host sends your browser
  the code that handles your password. It never sees your memos — but a hostile or breached
  host could ship altered code. Host it under an account that's yours, with 2FA on, that
  nobody else can push to. Route C avoids this entirely.
- **Malware on the device.** A keylogger sees your password as you type it. No web app can
  prevent that.
- **Someone holding your unlocked phone.** That's what the 30-second auto-lock is for.
- **Clearing browser data wipes the diary.** "Cookies and site data" includes it. The app
  asks Chrome to mark its storage persistent, which is usually granted to an installed app
  — but installing it and keeping a backup is the real protection.

---

## Files

```
My-Secret-Diary/
├── index.html                    the whole interface
├── manifest.json                 makes it installable on Android and desktop
├── sw.js                         offline cache for the app's own files
├── start.bat                     local server + browser launcher (PC only)
├── Create-Desktop-Shortcut.bat   run once, get the Desktop shortcut
├── assets/
│   ├── styles.css                the desk, the paper, the brass
│   ├── crypto.js                 PBKDF2 + AES-GCM. Read this one first
│   └── app.js                    memos, dates, locks, autosave
├── icons/                        app icon, all sizes, plus diary.ico
└── README.md
```

## What's stored

One key in localStorage, `msd.vault.v1`:

```json
{
  "v": 1,
  "kdf":   { "salt": "…", "iterations": 310000, "hash": "SHA-256" },
  "check": { "iv": "…", "ct": "…" },
  "data":  { "iv": "…", "ct": "…" }
}
```

`data` is every memo. `check` is a known phrase encrypted with the diary key — it's how a
correct password is recognised without storing the password. Titles, colours, and dates
live inside `data`, so they're encrypted too: a snooper reading localStorage learns only
that a diary exists and roughly how large it is.
