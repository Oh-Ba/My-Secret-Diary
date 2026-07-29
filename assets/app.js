/* ============================================================
   My Secret Diary — app logic
   Everything lives in this browser, in localStorage, encrypted.
   Nothing is ever sent anywhere.
   ============================================================ */

const STORE_KEY = 'msd.vault.v1';
const CHECK_PHRASE = 'my-secret-diary/v1';
const IDLE_MS = 5 * 60 * 1000;      // auto-lock after 5 minutes of no activity
const MIN_LEN = 8;

const PALETTE = [
  { name: 'Butter', hex: '#FFF4C9' },
  { name: 'Rose',   hex: '#FFDBE1' },
  { name: 'Sky',    hex: '#D3E8FF' },
  { name: 'Mint',   hex: '#CDF2DE' },
  { name: 'Lilac',  hex: '#E5D9FF' },
  { name: 'Peach',  hex: '#FFE1C6' },
  { name: 'Sage',   hex: '#E0EACB' },
  { name: 'Stone',  hex: '#E2E6EE' }
];

/* ── in-memory session state (all of this dies on lock) ───── */
let masterKey  = null;   // CryptoKey for the diary
let memos      = [];     // decrypted metadata + unsealed bodies
let currentId  = null;
const pageKeys   = new Map();  // memo id -> CryptoKey  (pages you unsealed this session)
const pageBodies = new Map();  // memo id -> plaintext  (never written to disk as-is)

let idleTimer = null;
let saveTimer = null;

const $ = (id) => document.getElementById(id);
const dateFmt = new Intl.DateTimeFormat(undefined, {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
});
const shortFmt = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: '2-digit' });

/* ── storage ─────────────────────────────────────────────── */
const readRaw  = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; } };
const writeRaw = (v) => localStorage.setItem(STORE_KEY, JSON.stringify(v));

async function persist() {
  const raw = readRaw();
  raw.data = await Vault.seal(masterKey, memos);
  raw.updated = new Date().toISOString();
  writeRaw(raw);
}

/* ── gate: first run + unlock ────────────────────────────── */
const gate = $('gate');
let isFirstRun = false;

function paintGate() {
  isFirstRun = !readRaw();
  $('gateSub').textContent = isFirstRun
    ? 'Choose the password that opens this diary. It is the only way in.'
    : 'Enter your diary password.';
  $('gateConfirmField').hidden = !isFirstRun;
  $('gateBtn').textContent = isFirstRun ? 'Create the diary' : 'Open the diary';
  $('gatePass').autocomplete = isFirstRun ? 'new-password' : 'current-password';
  $('gateFine').textContent = isFirstRun
    ? 'The password is never stored — it only unwraps the key that decrypts your memos. If you forget it, the memos cannot be recovered by anyone, including this app.'
    : '';
  $('gateNotice').textContent = '';
}

$('gateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = $('gatePass').value;
  const notice = $('gateNotice');
  const btn = $('gateBtn');

  if (isFirstRun) {
    if (pass.length < MIN_LEN) return setNotice(notice, `Use at least ${MIN_LEN} characters.`, 'bad');
    if (pass !== $('gatePass2').value) return setNotice(notice, 'The two passwords do not match.', 'bad');
    if (Vault.strength(pass) < 2) return setNotice(notice, 'Too easy to guess. Mix in length, cases, or symbols.', 'bad');
  } else if (!pass) {
    return setNotice(notice, 'Enter your password.', 'bad');
  }

  btn.disabled = true;
  setNotice(notice, isFirstRun ? 'Building your key…' : 'Checking…');
  await tick();

  try {
    if (isFirstRun) {
      const kdf = Vault.newKdf();
      const key = await Vault.deriveKey(pass, kdf);
      writeRaw({
        v: 1,
        kdf,
        check: await Vault.seal(key, CHECK_PHRASE),
        data: await Vault.seal(key, []),
        created: new Date().toISOString()
      });
      masterKey = key;
      memos = [];
    } else {
      const raw = readRaw();
      const key = await Vault.deriveKey(pass, raw.kdf);
      const phrase = await Vault.open(key, raw.check);   // throws on a wrong password
      if (phrase !== CHECK_PHRASE) throw new Error('bad vault');
      masterKey = key;
      memos = await Vault.open(key, raw.data);
    }
    enterDiary();
  } catch {
    setNotice(notice, 'That password does not open this diary.', 'bad');
    gate.classList.add('shake');
    setTimeout(() => gate.classList.remove('shake'), 420);
  } finally {
    btn.disabled = false;
    $('gatePass').value = '';
    $('gatePass2').value = '';
    $('gatePass').focus();
  }
});

function enterDiary() {
  gate.hidden = true;
  $('app').hidden = false;
  renderList();
  const first = sortedMemos()[0];
  if (first) selectMemo(first.id); else showEmpty();
  resetIdle();
  $('search').value = '';
}

function lockDiary(reason) {
  flushSave();
  masterKey = null;
  memos = [];
  currentId = null;
  pageKeys.clear();
  pageBodies.clear();
  clearTimeout(idleTimer);
  clearTimeout(hiddenTimer);
  closeSidebar();
  closeMenu();
  $('app').hidden = true;
  gate.hidden = false;
  paintGate();
  $('gatePass').focus();
  if (reason) setNotice($('gateNotice'), reason);
}

/* ── idle auto-lock ──────────────────────────────────────── */
function resetIdle() {
  if (!masterKey) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => lockDiary('Locked after five quiet minutes.'), IDLE_MS);
}
['pointerdown', 'keydown', 'input', 'scroll', 'touchstart'].forEach(evt =>
  window.addEventListener(evt, resetIdle, { passive: true })
);

/* On a phone the diary is usually closed by switching away from it, not by
   pressing Lock. So: leave for more than a moment and it shuts itself.
   The grace period is there for the times you flick away to copy something. */
const HIDDEN_GRACE_MS = 30 * 1000;
let hiddenTimer = null;

document.addEventListener('visibilitychange', () => {
  if (!masterKey) return;
  if (document.hidden) {
    flushSave();
    hiddenTimer = setTimeout(() => lockDiary('Locked while you were away.'), HIDDEN_GRACE_MS);
  } else {
    clearTimeout(hiddenTimer);
    resetIdle();
  }
});

/* ── list ────────────────────────────────────────────────── */
const sortedMemos = () => [...memos].sort((a, b) => b.updated.localeCompare(a.updated));

function visibleMemos() {
  const q = $('search').value.trim().toLowerCase();
  const all = sortedMemos();
  if (!q) return all;
  return all.filter(m => {
    if (m.title.toLowerCase().includes(q)) return true;
    const body = m.seal ? pageBodies.get(m.id) : m.body;
    return !!body && body.toLowerCase().includes(q);
  });
}

function renderList() {
  const list = $('pageList');
  list.innerHTML = '';
  const rows = visibleMemos();

  rows.forEach(m => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'card' + (m.seal && !pageKeys.has(m.id) ? ' is-sealed' : '');
    btn.style.background = m.color;
    btn.setAttribute('aria-current', String(m.id === currentId));
    btn.innerHTML = `
      <p class="card-title"></p>
      <p class="card-meta"></p>
      ${m.seal ? '<span class="card-seal"></span>' : ''}`;
    btn.querySelector('.card-title').textContent = m.title || 'Untitled memo';
    btn.querySelector('.card-meta').textContent = shortFmt.format(new Date(m.updated));
    btn.addEventListener('click', () => { selectMemo(m.id); closeSidebar(); });
    li.appendChild(btn);
    list.appendChild(li);
  });

  const sealed = memos.filter(m => m.seal).length;
  $('pageCount').textContent = memos.length
    ? `${memos.length} memo${memos.length > 1 ? 's' : ''}${sealed ? ` · ${sealed} with its own password` : ''}`
    : 'No memos yet';
  $('empty').hidden = memos.length > 0;
  if (!memos.length) $('sheet').hidden = true;
}

function showEmpty() {
  currentId = null;
  $('sheet').hidden = true;
  $('empty').hidden = memos.length > 0;
}

/* ── sheet ───────────────────────────────────────────────── */
const memoById = (id) => memos.find(m => m.id === id);

function selectMemo(id) {
  flushSave();
  currentId = id;
  const m = memoById(id);
  if (!m) return showEmpty();

  $('empty').hidden = true;
  $('sheet').hidden = false;
  $('sheet').style.setProperty('--paper', m.color);
  $('title').value = m.title;
  $('meta').innerHTML = `<span>Started ${dateFmt.format(new Date(m.created))}</span>
                         <span>Last changed ${dateFmt.format(new Date(m.updated))}</span>`;

  const sealedShut = m.seal && !pageKeys.has(m.id);
  $('bodyInput').hidden = sealedShut;
  $('sealed').hidden = !sealedShut;
  $('sheetFoot').hidden = sealedShut;
  setNotice($('sealedNotice'), '');
  $('sealedPass').value = '';

  if (!sealedShut) {
    $('bodyInput').value = m.seal ? (pageBodies.get(m.id) || '') : (m.body || '');
    setSaveState('Saved');
  }

  renderSwatches(m);
  renderTools(m);
  renderList();
}

function renderSwatches(m) {
  const box = $('swatches');
  box.innerHTML = '';
  PALETTE.forEach(c => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c.hex;
    b.title = c.name;
    b.setAttribute('aria-label', `${c.name} paper`);
    b.setAttribute('aria-pressed', String(c.hex.toLowerCase() === m.color.toLowerCase()));
    b.addEventListener('click', async () => {
      m.color = c.hex;
      touch(m);
      $('sheet').style.setProperty('--paper', c.hex);
      renderSwatches(m);
      await persist();
      renderList();
      refreshMeta(m);
    });
    box.appendChild(b);
  });
}

function renderTools(m) {
  const lockBtn = $('pageLockBtn');
  if (!m.seal) {
    lockBtn.hidden = false;
    lockBtn.textContent = 'Lock this memo';
    lockBtn.onclick = () => setPagePassword(m);
  } else if (pageKeys.has(m.id)) {
    lockBtn.hidden = false;
    lockBtn.textContent = 'Memo password…';
    lockBtn.onclick = () => managePagePassword(m);
  } else {
    lockBtn.hidden = true;
  }
}

function refreshMeta(m) {
  $('meta').innerHTML = `<span>Started ${dateFmt.format(new Date(m.created))}</span>
                         <span>Last changed ${dateFmt.format(new Date(m.updated))}</span>`;
}

const touch = (m) => { m.updated = new Date().toISOString(); };

/* ── writing + autosave ──────────────────────────────────── */
function queueSave() {
  setSaveState('Writing…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 700);
}

async function flushSave() {
  clearTimeout(saveTimer);
  if (!masterKey || !currentId) return;
  const m = memoById(currentId);
  if (!m) return;

  const title = $('title').value;
  const body = $('bodyInput').hidden ? null : $('bodyInput').value;

  const titleChanged = title !== m.title;
  const currentBody = m.seal ? pageBodies.get(m.id) : m.body;
  const bodyChanged = body !== null && body !== currentBody;
  if (!titleChanged && !bodyChanged) return;

  m.title = title;
  if (bodyChanged) {
    if (m.seal) {
      pageBodies.set(m.id, body);
      const box = await Vault.seal(pageKeys.get(m.id), body);
      m.seal = { kdf: m.seal.kdf, iv: box.iv, ct: box.ct };
    } else {
      m.body = body;
    }
  }
  touch(m);
  await persist();
  refreshMeta(m);
  renderList();
  setSaveState('Saved · encrypted');
}

const setSaveState = (t) => { $('saveState').textContent = t; };

$('title').addEventListener('input', queueSave);
$('bodyInput').addEventListener('input', queueSave);
window.addEventListener('pagehide', flushSave);

/* ── new / delete ────────────────────────────────────────── */
async function newMemo() {
  const m = {
    id: crypto.randomUUID(),
    title: '',
    color: PALETTE[memos.length % PALETTE.length].hex,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    body: '',
    seal: null
  };
  memos.push(m);
  await persist();
  renderList();
  selectMemo(m.id);
  $('title').focus();
}
$('newBtn').addEventListener('click', newMemo);
$('emptyNewBtn').addEventListener('click', newMemo);

$('deleteBtn').addEventListener('click', async () => {
  const m = memoById(currentId);
  if (!m) return;
  const ok = await confirmModal({
    title: 'Delete this memo?',
    sub: `“${m.title || 'Untitled memo'}” will be erased from this browser. There is no undo and no copy anywhere else.`,
    ok: 'Delete memo'
  });
  if (!ok) return;
  memos = memos.filter(x => x.id !== m.id);
  pageKeys.delete(m.id);
  pageBodies.delete(m.id);
  await persist();
  renderList();
  const next = sortedMemos()[0];
  if (next) selectMemo(next.id); else showEmpty();
  toast('Memo deleted');
});

/* ── per-memo passwords ──────────────────────────────────── */
async function setPagePassword(m) {
  await askModal({
    title: 'Give this memo its own password',
    sub: 'The text of this memo gets a second lock, with its own key. Opening the diary will no longer be enough — this memo will ask for this password too.',
    fields: [
      { id: 'p1', label: 'Memo password', type: 'password' },
      { id: 'p2', label: 'Repeat password', type: 'password' }
    ],
    ok: 'Lock this memo',
    onSubmit: async ({ p1, p2 }) => {
      if (p1.length < MIN_LEN) return `Use at least ${MIN_LEN} characters.`;
      if (p1 !== p2) return 'The two passwords do not match.';
      const kdf = Vault.newKdf();
      const key = await Vault.deriveKey(p1, kdf);
      const text = $('bodyInput').value;
      const box = await Vault.seal(key, text);
      m.seal = { kdf, iv: box.iv, ct: box.ct };
      m.body = null;
      pageKeys.set(m.id, key);
      pageBodies.set(m.id, text);
      touch(m);
      await persist();
      renderTools(m);
      refreshMeta(m);
      renderList();
      toast('Memo locked with its own password');
    }
  });
}

async function managePagePassword(m) {
  await askModal({
    title: 'This memo’s password',
    sub: 'Change the password that opens this memo, or remove it so the diary password alone is enough. Leave both fields empty to remove it.',
    fields: [
      { id: 'p1', label: 'New memo password', type: 'password' },
      { id: 'p2', label: 'Repeat new password', type: 'password' }
    ],
    ok: 'Save',
    onSubmit: async ({ p1, p2 }) => {
      const text = pageBodies.get(m.id) ?? $('bodyInput').value;
      if (!p1 && !p2) {
        m.seal = null;
        m.body = text;
        pageKeys.delete(m.id);
        pageBodies.delete(m.id);
        touch(m);
        await persist();
        selectMemo(m.id);
        toast('Memo password removed');
        return;
      }
      if (p1.length < MIN_LEN) return `Use at least ${MIN_LEN} characters.`;
      if (p1 !== p2) return 'The two passwords do not match.';
      const kdf = Vault.newKdf();
      const key = await Vault.deriveKey(p1, kdf);
      const box = await Vault.seal(key, text);
      m.seal = { kdf, iv: box.iv, ct: box.ct };
      pageKeys.set(m.id, key);
      pageBodies.set(m.id, text);
      touch(m);
      await persist();
      refreshMeta(m);
      renderList();
      toast('Memo password changed');
    }
  });
}

$('sealedForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const m = memoById(currentId);
  if (!m || !m.seal) return;
  const pass = $('sealedPass').value;
  const notice = $('sealedNotice');
  if (!pass) return setNotice(notice, 'Enter this memo’s password.', 'bad');

  setNotice(notice, 'Checking…');
  await tick();
  try {
    const key = await Vault.deriveKey(pass, m.seal.kdf);
    const text = await Vault.open(key, { iv: m.seal.iv, ct: m.seal.ct });
    pageKeys.set(m.id, key);
    pageBodies.set(m.id, text);
    selectMemo(m.id);
    $('bodyInput').focus();
  } catch {
    setNotice(notice, 'That password does not open this memo.', 'bad');
  } finally {
    $('sealedPass').value = '';
  }
});

/* ── diary password change ───────────────────────────────── */
$('changePassBtn').addEventListener('click', () => {
  askModal({
    title: 'Change the diary password',
    sub: 'Every memo is re-encrypted with a key built from the new password. Memo passwords are untouched.',
    fields: [
      { id: 'old', label: 'Current password', type: 'password' },
      { id: 'p1',  label: 'New password', type: 'password' },
      { id: 'p2',  label: 'Repeat new password', type: 'password' }
    ],
    ok: 'Change password',
    onSubmit: async ({ old, p1, p2 }) => {
      const raw = readRaw();
      try {
        const k = await Vault.deriveKey(old, raw.kdf);
        await Vault.open(k, raw.check);
      } catch { return 'The current password is wrong.'; }
      if (p1.length < MIN_LEN) return `Use at least ${MIN_LEN} characters.`;
      if (p1 !== p2) return 'The two new passwords do not match.';
      if (Vault.strength(p1) < 2) return 'Too easy to guess. Mix in length, cases, or symbols.';

      const kdf = Vault.newKdf();
      const key = await Vault.deriveKey(p1, kdf);
      writeRaw({
        v: 1, kdf,
        check: await Vault.seal(key, CHECK_PHRASE),
        data: await Vault.seal(key, memos),
        created: raw.created,
        updated: new Date().toISOString()
      });
      masterKey = key;
      toast('Diary password changed');
    }
  });
});

/* ── backup / restore ────────────────────────────────────── */
$('backupBtn').addEventListener('click', async () => {
  await flushSave();
  const name = `my-secret-diary-${new Date().toISOString().slice(0, 10)}.json`;
  const text = JSON.stringify(readRaw(), null, 2);
  const blob = new Blob([text], { type: 'application/json' });

  // On a phone, hand it to the share sheet (Drive, Files, anywhere).
  // On a desktop, just download it.
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My Secret Diary backup' });
      return toast('Backup shared — still encrypted');
    } catch (err) {
      if (err && err.name === 'AbortError') return;   // user changed their mind
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup saved — still encrypted, still needs your password');
});

$('restoreBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let incoming;
  try {
    incoming = JSON.parse(await file.text());
    if (incoming.v !== 1 || !incoming.kdf || !incoming.check || !incoming.data) throw 0;
  } catch {
    return toast('That file is not a diary backup');
  }
  const ok = await confirmModal({
    title: 'Restore this backup?',
    sub: 'The memos now in this browser are replaced by the ones in the file. The diary then locks, and reopens with the password that belongs to the backup.',
    ok: 'Restore backup'
  });
  if (!ok) return;
  writeRaw(incoming);
  lockDiary('Backup restored. Enter the password for that backup.');
});

/* ── lock button, drawer, overflow menu ──────────────────── */
$('lockBtn').addEventListener('click', () => lockDiary('Diary locked.'));
$('search').addEventListener('input', renderList);

function openSidebar() {
  $('sidebar').classList.add('open');
  $('scrim').hidden = false;
  $('menuBtn').setAttribute('aria-expanded', 'true');
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('scrim').hidden = true;
  $('menuBtn').setAttribute('aria-expanded', 'false');
}
$('menuBtn').addEventListener('click', () =>
  $('sidebar').classList.contains('open') ? closeSidebar() : openSidebar());
$('scrim').addEventListener('click', closeSidebar);

const menuOpen = () => !$('moreMenu').hidden;
function closeMenu() { $('moreMenu').hidden = true; $('moreBtn').setAttribute('aria-expanded', 'false'); }
function openMenu() { $('moreMenu').hidden = false; $('moreBtn').setAttribute('aria-expanded', 'true'); }
$('moreBtn').addEventListener('click', (e) => { e.stopPropagation(); menuOpen() ? closeMenu() : openMenu(); });
$('moreMenu').addEventListener('click', closeMenu);
document.addEventListener('click', () => { if (menuOpen()) closeMenu(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuOpen()) closeMenu();
  if (e.key === 'Escape' && $('sidebar').classList.contains('open')) closeSidebar();
  if (e.key === 'Escape' && !$('modal').hidden) $('modalCancel').click();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); flushSave(); }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l' && masterKey) lockDiary('Diary locked.');
});

/* ── small helpers ───────────────────────────────────────── */
function setNotice(el, text, tone) {
  el.textContent = text || '';
  if (tone) el.dataset.tone = tone; else delete el.dataset.tone;
}
const tick = () => new Promise(r => setTimeout(r, 16));

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 2600);
}

function askModal({ title, sub, fields = [], ok = 'Confirm', onSubmit }) {
  return new Promise(resolve => {
    const modal = $('modal'), form = $('modalForm');
    $('modalTitle').textContent = title;
    $('modalSub').textContent = sub || '';
    $('modalOk').textContent = ok;
    setNotice($('modalNotice'), '');

    const box = $('modalFields');
    box.innerHTML = '';
    fields.forEach(f => {
      const label = document.createElement('label');
      label.className = 'field';
      label.innerHTML = `<span class="field-label"></span><input type="${f.type || 'text'}" autocomplete="off" spellcheck="false">`;
      label.querySelector('.field-label').textContent = f.label;
      label.querySelector('input').id = `mf_${f.id}`;
      box.appendChild(label);
    });

    modal.hidden = false;
    const firstInput = box.querySelector('input');
    if (firstInput) firstInput.focus();

    const close = (result) => {
      form.onsubmit = null;
      $('modalCancel').onclick = null;
      box.innerHTML = '';
      setNotice($('modalNotice'), '');
      modal.hidden = true;
      resolve(result);
    };

    $('modalCancel').onclick = () => close(false);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const values = {};
      fields.forEach(f => { values[f.id] = $(`mf_${f.id}`).value; });
      $('modalOk').disabled = true;
      setNotice($('modalNotice'), 'Working…');
      await tick();
      try {
        const err = onSubmit ? await onSubmit(values) : null;
        if (err) { setNotice($('modalNotice'), err, 'bad'); return; }
        close(true);
      } catch (ex) {
        setNotice($('modalNotice'), 'That did not work. Try again.', 'bad');
      } finally {
        $('modalOk').disabled = false;
      }
    };
  });
}

const confirmModal = ({ title, sub, ok }) => askModal({ title, sub, fields: [], ok });

/* ── boot ────────────────────────────────────────────────── */
(function boot() {
  if (!window.crypto || !crypto.subtle) {
    document.body.innerHTML =
      '<div class="gate"><div class="gate-card"><h1 class="gate-title">Encryption unavailable</h1>' +
      '<p class="gate-sub">This browser is not giving the app access to WebCrypto, so the diary cannot protect anything. ' +
      'Open the app through start.bat instead of double-clicking index.html.</p></div></div>';
    return;
  }
  paintGate();
  $('gatePass').focus();

  // Keep the app itself available offline (needs https or localhost).
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* not fatal — the diary still works */ });
  }

  // Ask the browser not to evict this origin's storage when space runs low.
  // Installed apps are usually granted this without a prompt.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(ok => { if (!ok) navigator.storage.persist(); }).catch(() => {});
  }

  // "Install on this device" — Android and desktop Chrome offer this to us.
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    $('installBtn').hidden = false;
  });
  $('installBtn').addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    $('installBtn').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; });
})();
