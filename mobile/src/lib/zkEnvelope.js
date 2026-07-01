import 'react-native-get-random-values';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { gcm } from '@noble/ciphers/aes.js';

const PBKDF2_ITERS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const DEK_BYTES = 32;
const PREFIX = 'zk1:';
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const enc = new TextEncoder();

export function generateSalt() {
  return bytesToBase64(randomBytes(SALT_BYTES));
}

function deriveKeyBytes(secret, saltB64) {
  return pbkdf2(sha256, enc.encode(secret), base64ToBytes(saltB64), {
    c: PBKDF2_ITERS,
    dkLen: 32,
  });
}

export async function deriveAuthVerifier(secret, saltB64) {
  const bits = deriveKeyBytes(secret, saltB64);
  return Array.from(bits).map(b => b.toString(16).padStart(2, '0')).join('');
}

function wrapBytes(plaintext, wrappingKey) {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = gcm(wrappingKey, iv).encrypt(plaintext);
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return PREFIX + bytesToBase64(combined);
}

function unwrapBytes(blob, wrappingKey) {
  if (typeof blob !== 'string' || !blob.startsWith(PREFIX)) {
    throw new Error('Bad wrapped key format.');
  }
  const combined = base64ToBytes(blob.slice(PREFIX.length));
  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);
  return gcm(wrappingKey, iv).decrypt(ciphertext);
}

function generateRecoveryCode() {
  const bytes = randomBytes(20);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    if (i > 0 && i % 4 === 0) out += '-';
    out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  }
  return out;
}

function normalizeRecoveryCode(code) {
  return String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function createEnvelope(password) {
  const authSalt = generateSalt();
  const kdfSalt = generateSalt();
  const recoverySalt = generateSalt();
  const recoveryAuthSalt = generateSalt();
  const recoveryCode = generateRecoveryCode();
  const normalizedRecoveryCode = normalizeRecoveryCode(recoveryCode);

  const dek = randomBytes(DEK_BYTES);
  const passwordKey = deriveKeyBytes(password, kdfSalt);
  const recoveryKey = deriveKeyBytes(normalizedRecoveryCode, recoverySalt);

  return {
    authVerifier: await deriveAuthVerifier(password, authSalt),
    authSalt,
    kdfSalt,
    recoverySalt,
    recoveryAuthSalt,
    recoveryVerifier: await deriveAuthVerifier(normalizedRecoveryCode, recoveryAuthSalt),
    wrappedDekPassword: wrapBytes(dek, passwordKey),
    wrappedDekRecovery: wrapBytes(dek, recoveryKey),
    recoveryCode,
    dek,
  };
}

export async function deriveRecoveryVerifier(recoveryCode, recoveryAuthSaltB64) {
  return deriveAuthVerifier(normalizeRecoveryCode(recoveryCode), recoveryAuthSaltB64);
}

export async function unlockWithPassword(envelope, password) {
  const wrappingKey = deriveKeyBytes(password, envelope.kdfSalt);
  return unwrapBytes(envelope.wrappedDekPassword, wrappingKey);
}

export async function unlockWithRecovery(envelope, recoveryCode) {
  const wrappingKey = deriveKeyBytes(normalizeRecoveryCode(recoveryCode), envelope.recoverySalt);
  return unwrapBytes(envelope.wrappedDekRecovery, wrappingKey);
}

export async function rewrapForPassword(dek, newPassword) {
  const authSalt = generateSalt();
  const kdfSalt = generateSalt();
  const wrappingKey = deriveKeyBytes(newPassword, kdfSalt);
  return {
    authVerifier: await deriveAuthVerifier(newPassword, authSalt),
    authSalt,
    kdfSalt,
    wrappedDekPassword: wrapBytes(dek, wrappingKey),
  };
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
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
  let outIndex = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_CHARS.indexOf(clean[i]);
    const c1 = B64_CHARS.indexOf(clean[i + 1]);
    const c2 = clean[i + 2] === undefined ? 0 : B64_CHARS.indexOf(clean[i + 2]);
    const c3 = clean[i + 3] === undefined ? 0 : B64_CHARS.indexOf(clean[i + 3]);
    const n = (c0 << 18) | (c1 << 12) | ((c2 & 63) << 6) | (c3 & 63);

    bytes[outIndex++] = (n >> 16) & 255;
    if (clean[i + 2] !== undefined) bytes[outIndex++] = (n >> 8) & 255;
    if (clean[i + 3] !== undefined) bytes[outIndex++] = n & 255;
  }

  return bytes.subarray(0, outIndex);
}
