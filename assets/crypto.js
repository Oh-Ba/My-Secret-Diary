/* ============================================================
   My Secret Diary — crypto layer
   ------------------------------------------------------------
   Design rules this file follows:

   1. No password is ever stored. Not in plaintext, not hashed.
      A password only exists in memory while you are typing it.
   2. The password derives a key (PBKDF2-HMAC-SHA-256, 310,000
      iterations, 16-byte random salt). That key never leaves memory
      and is marked non-extractable by WebCrypto.
   3. Everything on disk is ciphertext (AES-256-GCM, fresh random
      12-byte IV per write). GCM is authenticated, so a tampered
      file fails to decrypt instead of silently returning junk.
   4. A wrong password simply fails to decrypt. There is no hash to
      compare, so there is nothing to leak and nothing to time.
   ============================================================ */

const Vault = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const ITERATIONS = 310000;   // OWASP floor for PBKDF2-HMAC-SHA-256
  const SALT_BYTES = 16;
  const IV_BYTES   = 12;

  function toB64(bytes) {
    const b = ArrayBuffer.isView(bytes)
      ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : new Uint8Array(bytes);
    let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }

  function fromB64(str) {
    const s = atob(str);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  function randomBytes(n) {
    return crypto.getRandomValues(new Uint8Array(n));
  }

  function newKdf() {
    return { salt: toB64(randomBytes(SALT_BYTES)), iterations: ITERATIONS, hash: 'SHA-256' };
  }

  /** Turn a password + kdf params into a non-extractable AES-GCM key. */
  async function deriveKey(password, kdf) {
    const material = await crypto.subtle.importKey(
      'raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: fromB64(kdf.salt), iterations: kdf.iterations, hash: kdf.hash || 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,                       // non-extractable
      ['encrypt', 'decrypt']
    );
  }

  /** value (any JSON-able) -> { iv, ct } */
  async function seal(key, value) {
    const iv = randomBytes(IV_BYTES);
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))
    );
    return { iv: toB64(iv), ct: toB64(ct) };
  }

  /** { iv, ct } -> value. Throws if the key is wrong or bytes were tampered with. */
  async function open(key, box) {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.ct)
    );
    return JSON.parse(dec.decode(pt));
  }

  /** Rough strength read-out, used only to nudge — never to block. */
  function strength(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 14) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^\w\s]/.test(pw)) score++;
    if (/^(.)\1+$/.test(pw)) score = 0;
    return Math.min(score, 4);
  }

  return { deriveKey, seal, open, newKdf, strength, ITERATIONS };
})();
