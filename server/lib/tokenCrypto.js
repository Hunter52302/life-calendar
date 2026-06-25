/**
 * Encryption-at-rest for stored OAuth tokens (Google/Microsoft access +
 * refresh tokens). These let the server act on a user's behalf, so a DB leak
 * must not hand an attacker live tokens.
 *
 * We do NOT reuse JWT_SECRET directly as the encryption key — that secret's
 * job is signing auth tokens. Instead we derive a separate 256-bit key from it
 * via scrypt with a fixed context label (key separation). Rotating JWT_SECRET
 * therefore invalidates stored tokens, which is why .env.example tells the
 * operator that rotating it means reconnecting calendars.
 *
 * Format (string): "v1:" + base64(iv | authTag | ciphertext)
 *   iv      = 12 bytes (GCM nonce)
 *   authTag = 16 bytes
 */
import crypto from 'node:crypto';

const IV_BYTES  = 12;
const TAG_BYTES = 16;
const KEY_LABEL = 'pls-calendar:oauth-token-encryption:v1';

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required to encrypt OAuth tokens.');
  }
  // scrypt is deterministic given (secret, salt) → stable key across restarts.
  cachedKey = crypto.scryptSync(secret, KEY_LABEL, 32);
  return cachedKey;
}

/** Encrypt a token string. Returns null/undefined unchanged so callers can pass optional values. */
export function encryptToken(plaintext) {
  if (plaintext == null) return plaintext;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'v1:' + Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decrypt a token produced by encryptToken. Throws if tampered or wrong key. */
export function decryptToken(stored) {
  if (stored == null) return stored;
  if (typeof stored !== 'string' || !stored.startsWith('v1:')) {
    throw new Error('Unrecognized token ciphertext format.');
  }
  const buf = Buffer.from(stored.slice(3), 'base64');
  const iv  = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct  = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct, undefined, 'utf8') + decipher.final('utf8');
}
