/**
 * AES-256-GCM encrypt / decrypt helpers.
 *
 * Used to store "previous value" snapshots of secrets in PocketBase so we never
 * keep plain-text keys on disk.
 *
 * Key derivation: scryptSync(JWT_SECRET, fixed-salt, 32) — deterministic so
 * the key is always the same across restarts as long as JWT_SECRET doesn't
 * change.
 *
 * ⚠️  If JWT_SECRET is rotated, previously encrypted snapshots become
 *    unreadable. The server logs a clear warning on startup.
 *
 * Storage format: "iv:authTag:ciphertext"  (all hex, colon-separated)
 */

import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';

const SALT      = 'lc-secrets-v1-salt';   // Fixed — changing this breaks existing ciphertext
const KEY_LEN   = 32;                      // 256-bit key for AES-256-GCM
const IV_LEN    = 12;                      // GCM standard IV length

// Derive once per process — cached at module level
let _key = null;
function getKey() {
  if (_key) return _key;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      '[crypto] JWT_SECRET is not set. Cannot derive encryption key for secrets storage.'
    );
  }
  _key = scryptSync(secret, SALT, KEY_LEN);
  return _key;
}

/**
 * Encrypt a plain-text string.
 * @param   {string} plaintext
 * @returns {string} "iv:authTag:ciphertext" (hex)
 */
export function encrypt(plaintext) {
  const key  = getKey();
  const iv   = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypt a string previously produced by `encrypt()`.
 * @param   {string} encoded "iv:authTag:ciphertext" (hex)
 * @returns {string} original plain text
 */
export function decrypt(encoded) {
  const key = getKey();
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('[crypto] Invalid encrypted format');

  const [ivHex, tagHex, ctHex] = parts;
  const iv         = Buffer.from(ivHex,  'hex');
  const authTag    = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ctHex,  'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
