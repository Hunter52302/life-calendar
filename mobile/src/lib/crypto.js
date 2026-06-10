/**
 * Zero-knowledge encryption helpers — React Native edition.
 *
 * Mirrors src/lib/crypto.js on the web exactly (PBKDF2-SHA256 600k
 * iterations + AES-256-GCM, blob = base64(iv + ciphertext + tag)) so a
 * key derived on either platform decrypts data written by the other.
 * Uses the audited pure-JS @noble libraries since React Native has no
 * SubtleCrypto.
 */
import 'react-native-get-random-values';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { gcm } from '@noble/ciphers/aes.js';

const PBKDF2_ITERATIONS = 600_000;
const ZK_VERIFY_CONSTANT = 'pls-calendar-zk-v1';
const enc = new TextEncoder();
const dec = new TextDecoder();

// ── Salt generation ───────────────────────────────────────────────────────────

/** Generate a random 32-byte salt as a hex string. */
export function generateSalt() {
  return Array.from(randomBytes(32)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Key derivation ────────────────────────────────────────────────────────────

/**
 * Derives the 256-bit master key from a password + hex salt.
 * Returns a Uint8Array (kept in JS memory only — never persisted).
 * CPU-bound: takes a few seconds on a phone; callers should show a spinner.
 */
export async function deriveKey(password, saltHex) {
  // Yield to the UI thread once before the synchronous PBKDF2 burn
  await new Promise(r => setTimeout(r, 30));
  return pbkdf2(sha256, enc.encode(password), hexToBytes(saltHex), {
    c: PBKDF2_ITERATIONS,
    dkLen: 32,
  });
}

// ── Field encryption / decryption ─────────────────────────────────────────────

/** Encrypt a plaintext string. Returns base64(iv + ciphertext + tag). */
export async function encryptField(masterKey, plaintext) {
  if (!plaintext) return plaintext;
  const iv = randomBytes(12);
  const ciphertext = gcm(masterKey, iv).encrypt(enc.encode(plaintext));
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return bytesToBase64(combined);
}

/**
 * Decrypt an encrypted field. Returns the original plaintext string.
 * Returns the raw value unchanged when it isn't a valid blob (legacy
 * plaintext rows) or the key is wrong — same semantics as the web.
 */
export async function decryptField(masterKey, ciphertext) {
  if (!ciphertext) return ciphertext;
  if (!isBase64(ciphertext)) return ciphertext;
  try {
    const combined = base64ToBytes(ciphertext);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    return dec.decode(gcm(masterKey, iv).decrypt(data));
  } catch {
    return ciphertext;
  }
}

// ── Key verification ──────────────────────────────────────────────────────────

/** Generate the verification blob: encrypts a known constant. */
export async function generateVerifyBlob(masterKey) {
  return encryptField(masterKey, ZK_VERIFY_CONSTANT);
}

/** Returns true if masterKey decrypts the blob to the known constant. */
export async function verifyKey(masterKey, blob) {
  try {
    return (await decryptField(masterKey, blob)) === ZK_VERIFY_CONSTANT;
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

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    out += b1 === undefined ? '=' : B64_CHARS[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    out += b2 === undefined ? '=' : B64_CHARS[b2 & 63];
  }
  return out;
}

function base64ToBytes(b64) {
  const clean = b64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64_CHARS.indexOf(clean[i]) << 18)
            | (B64_CHARS.indexOf(clean[i + 1]) << 12)
            | ((B64_CHARS.indexOf(clean[i + 2]) & 63) << 6)
            | (B64_CHARS.indexOf(clean[i + 3]) & 63);
    bytes[o++] = (n >> 16) & 255;
    if (clean[i + 2] !== undefined) bytes[o++] = (n >> 8) & 255;
    if (clean[i + 3] !== undefined) bytes[o++] = n & 255;
  }
  return bytes;
}

function isBase64(str) {
  if (typeof str !== 'string' || str.length < 16) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(str);
}
