import { encryptField, decryptField, DECRYPT_FAILURE_PLACEHOLDER } from './crypto.js';

/** Encrypt the given string fields of a record. Falsy/absent fields are left untouched. */
export async function encryptRecord(key, record, fields) {
  const out = { ...record };
  for (const f of fields) {
    if (out[f]) out[f] = await encryptField(key, out[f]);
  }
  return out;
}

/**
 * Decrypt the given string fields of a record. Falsy/absent fields are left untouched;
 * a field that fails to decrypt becomes DECRYPT_FAILURE_PLACEHOLDER rather than raw ciphertext.
 */
export async function decryptRecord(key, record, fields) {
  const out = { ...record };
  for (const f of fields) {
    if (out[f]) out[f] = (await decryptField(key, out[f])) ?? DECRYPT_FAILURE_PLACEHOLDER;
  }
  return out;
}

/** Same idea as encryptRecord, but for a single field holding a JSON-serializable array/object. */
export async function encryptJsonField(key, value) {
  return value?.length ? encryptField(key, JSON.stringify(value)) : value;
}

/** Inverse of encryptJsonField. Falls back to `[]` if the field is absent or fails to decrypt/parse. */
export async function decryptJsonField(key, value) {
  if (!value || typeof value !== 'string') return value;
  const decrypted = await decryptField(key, value);
  if (decrypted === null) return [];
  try { return JSON.parse(decrypted); } catch { return []; }
}
