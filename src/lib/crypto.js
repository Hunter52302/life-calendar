/**
 * Zero-knowledge encryption helpers.
 * Uses the browser's native SubtleCrypto API — zero external dependencies.
 * PBKDF2-SHA256 key derivation + AES-256-GCM field encryption.
 */

const PBKDF2_ITERATIONS = 600_000;
const ZK_VERIFY_CONSTANT = 'pls-calendar-zk-v1';
const enc = new TextEncoder();
const dec = new TextDecoder();

// ── Salt generation ───────────────────────────────────────────────────────────

/** Generate a random 32-byte salt as a hex string. */
export function generateSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Key derivation ────────────────────────────────────────────────────────────

/**
 * Derives a 256-bit AES-GCM CryptoKey from a password + hex salt.
 * This is the master key — it never leaves JS memory.
 */
export async function deriveKey(password, saltHex) {
  const saltBytes = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── Field encryption / decryption ─────────────────────────────────────────────

/**
 * Encrypt a plaintext string. Returns base64(iv + ciphertext + tag).
 * Each call uses a fresh random IV.
 */
export async function encryptField(masterKey, plaintext) {
  if (!plaintext) return plaintext;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    enc.encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64(combined);
}

/**
 * Decrypt an encrypted field. Returns the original plaintext string.
 * Throws if the key is wrong or the ciphertext is malformed.
 */
export async function decryptField(masterKey, ciphertext) {
  if (!ciphertext) return ciphertext;
  // If not base64-encoded (e.g. legacy plaintext), return as-is
  if (!isBase64(ciphertext)) return ciphertext;
  try {
    const combined = base64ToBytes(ciphertext);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, data);
    return dec.decode(plaintext);
  } catch {
    // Decryption failed — return the raw value so the UI doesn't break
    return ciphertext;
  }
}

// ── Key verification ──────────────────────────────────────────────────────────

/** Generate the verification blob: encrypts a known constant. */
export async function generateVerifyBlob(masterKey) {
  return encryptField(masterKey, ZK_VERIFY_CONSTANT);
}

/**
 * Returns true if masterKey can decrypt the blob and the result matches the constant.
 * Used at login to confirm the password is correct before proceeding.
 */
export async function verifyKey(masterKey, blob) {
  try {
    const result = await decryptField(masterKey, blob);
    return result === ZK_VERIFY_CONSTANT;
  } catch {
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function isBase64(str) {
  if (typeof str !== 'string' || str.length < 16) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(str);
}
