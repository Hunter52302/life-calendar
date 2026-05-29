/**
 * Admin routes — all under /api/admin/
 *
 * POST   /api/admin/auth                      requireAuth  → issues 1h admin JWT
 * GET    /api/admin/secrets                   requireAdmin → list all secret metadata
 * POST   /api/admin/secrets                   requireAdmin → register + create in Infisical
 * PUT    /api/admin/secrets/:keyName          requireAdmin → rotate value (saves previous)
 * DELETE /api/admin/secrets/:keyName          requireAdmin → unregister (optionally from Infisical)
 * POST   /api/admin/secrets/:keyName/restore  requireAdmin → restore previous value
 * GET    /api/admin/infisical/status          requireAdmin → connection status
 */

import { Router }   from 'express';
import bcrypt       from 'bcryptjs';
import jwt          from 'jsonwebtoken';
import { users, secrets }    from '../db/queries.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getSecret,
  getInfisicalStatus,
  listInfisicalSecrets,
  createInfisicalSecret,
  updateInfisicalSecret,
  deleteInfisicalSecret,
  BLOCKED_KEY_NAMES,
} from '../lib/secrets.js';
import { encrypt, decrypt } from '../lib/crypto.js';

const router = Router();
const JWT_SECRET  = process.env.JWT_SECRET;
const ADMIN_TTL   = '1h';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute days until expiry from a unix timestamp. */
function daysUntilExpiry(expiresAt) {
  if (!expiresAt) return null;
  return Math.ceil((expiresAt - Math.floor(Date.now() / 1000)) / 86400);
}

/** Convert a DB row to a safe API response (no encrypted values exposed). */
function sanitizeRow(row) {
  return {
    keyName:          row.key_name,
    serviceName:      row.service_name,
    description:      row.description ?? '',
    expiresAt:        row.expires_at ?? null,
    daysUntilExpiry:  daysUntilExpiry(row.expires_at),
    infisicalManaged: row.infisical_managed === 1,
    hasPreviousValue: !!row.encrypted_previous_value,
    updatedAt:        row.updated_at,
    createdAt:        row.created_at,
  };
}

/** Validate a key name: uppercase letters, digits, underscores only. */
function isValidKeyName(name) {
  return typeof name === 'string' && /^[A-Z][A-Z0-9_]{0,127}$/.test(name);
}

// ── POST /api/admin/auth ──────────────────────────────────────────────────────
// Re-authenticate the current user and get a short-lived admin token.
// Requires the regular user JWT (requireAuth) + their password for re-auth.

router.post('/auth', requireAuth, async (req, res) => {
  const { password } = req.body ?? {};
  if (!password) return res.status(400).json({ error: 'password is required' });

  const user = users.getFirst();
  if (!user) return res.status(404).json({ error: 'No user found' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Incorrect password' });

  const adminToken = jwt.sign(
    { userId: user.id, isAdmin: true },
    JWT_SECRET,
    { expiresIn: ADMIN_TTL }
  );

  res.json({ adminToken });
});

// ── GET /api/admin/infisical/status ───────────────────────────────────────────

router.get('/infisical/status', requireAdmin, (_req, res) => {
  res.json(getInfisicalStatus());
});

// ── GET /api/admin/secrets ────────────────────────────────────────────────────

router.get('/secrets', requireAdmin, async (_req, res) => {
  const rows = secrets.getAll();

  // Merge with Infisical to flag any keys that exist there but not in our DB
  const infisicalList = await listInfisicalSecrets();
  const dbKeys = new Set(rows.map(r => r.key_name));

  const infisicalOnlyKeys = infisicalList
    .filter(s => !dbKeys.has(s.secretName) && !BLOCKED_KEY_NAMES.has(s.secretName))
    .map(s => ({
      keyName:          s.secretName,
      serviceName:      s.secretName,
      description:      s.secretComment || '',
      expiresAt:        null,
      daysUntilExpiry:  null,
      infisicalManaged: true,
      hasPreviousValue: false,
      updatedAt:        null,
      createdAt:        null,
      infisicalOnly:    true, // exists in Infisical but not yet registered in admin UI
    }));

  res.json([...rows.map(sanitizeRow), ...infisicalOnlyKeys]);
});

// ── POST /api/admin/secrets ───────────────────────────────────────────────────

router.post('/secrets', requireAdmin, async (req, res) => {
  const { keyName, serviceName, description, value, expiresAt } = req.body ?? {};

  // Validate
  if (!keyName)     return res.status(400).json({ error: 'keyName is required' });
  if (!serviceName) return res.status(400).json({ error: 'serviceName is required' });
  if (!value)       return res.status(400).json({ error: 'value is required' });

  if (!isValidKeyName(keyName)) {
    return res.status(400).json({
      error: 'keyName must be uppercase letters, digits and underscores only (e.g. GOOGLE_MAPS_API_KEY)',
    });
  }
  if (BLOCKED_KEY_NAMES.has(keyName)) {
    return res.status(400).json({
      error: `${keyName} is a startup-critical variable and cannot be managed here`,
    });
  }

  // Create in Infisical (if connected)
  const infisicalStatus = getInfisicalStatus();
  let infisicalManaged = false;
  if (infisicalStatus.connected) {
    try {
      await createInfisicalSecret(keyName, value);
      infisicalManaged = true;
    } catch (err) {
      // Not fatal — we still register the metadata locally
      console.warn(`[admin] Could not create ${keyName} in Infisical:`, err.message);
    }
  }

  const row = secrets.upsert(keyName, {
    serviceName,
    description: description ?? '',
    expiresAt:   expiresAt   ?? null,
    infisicalManaged,
  });

  res.status(201).json(sanitizeRow(row));
});

// ── PUT /api/admin/secrets/:keyName ───────────────────────────────────────────
// Rotate a secret's value or update its metadata (description, expiry).

router.put('/secrets/:keyName', requireAdmin, async (req, res) => {
  const { keyName } = req.params;
  const { value, serviceName, description, expiresAt } = req.body ?? {};

  const existing = secrets.getByKey(keyName);
  if (!existing) return res.status(404).json({ error: 'Secret not found' });

  if (value !== undefined && value !== '') {
    // Rotation: snapshot the current value as "previous"
    let encryptedPrev = null;
    try {
      const current = await getSecret(keyName);
      if (current) {
        encryptedPrev = encrypt(current);
      }
    } catch (err) {
      console.warn(`[admin] Could not snapshot current value for ${keyName}:`, err.message);
    }

    // Update in Infisical (if managed)
    const infisicalStatus = getInfisicalStatus();
    let infisicalManaged = existing.infisical_managed === 1;

    if (infisicalStatus.connected) {
      try {
        if (infisicalManaged) {
          await updateInfisicalSecret(keyName, value);
        } else {
          await createInfisicalSecret(keyName, value);
          infisicalManaged = true;
        }
      } catch (err) {
        console.warn(`[admin] Could not update ${keyName} in Infisical:`, err.message);
      }
    }

    secrets.patch(keyName, {
      encrypted_previous_value: encryptedPrev,
      infisical_managed: infisicalManaged ? 1 : 0,
      ...(serviceName  !== undefined && { service_name: serviceName }),
      ...(description  !== undefined && { description }),
      ...(expiresAt    !== undefined && { expires_at: expiresAt }),
    });
  } else {
    // Metadata-only update
    secrets.patch(keyName, {
      ...(serviceName !== undefined && { service_name: serviceName }),
      ...(description !== undefined && { description }),
      ...(expiresAt   !== undefined && { expires_at: expiresAt }),
    });
  }

  res.json(sanitizeRow(secrets.getByKey(keyName)));
});

// ── POST /api/admin/secrets/:keyName/restore ──────────────────────────────────
// Swap: previous value becomes current; current becomes previous.

router.post('/secrets/:keyName/restore', requireAdmin, async (req, res) => {
  const { keyName } = req.params;
  const existing = secrets.getByKey(keyName);

  if (!existing) return res.status(404).json({ error: 'Secret not found' });
  if (!existing.encrypted_previous_value) {
    return res.status(400).json({ error: 'No previous value to restore' });
  }

  let previousValue;
  try {
    previousValue = decrypt(existing.encrypted_previous_value);
  } catch {
    return res.status(500).json({ error: 'Could not decrypt previous value — JWT_SECRET may have changed' });
  }

  // Snapshot current value (so we can undo the restore)
  let encryptedCurrent = null;
  try {
    const current = await getSecret(keyName);
    if (current) encryptedCurrent = encrypt(current);
  } catch { /* non-fatal */ }

  // Push previous value to Infisical
  const infisicalStatus = getInfisicalStatus();
  if (infisicalStatus.connected && existing.infisical_managed) {
    try {
      await updateInfisicalSecret(keyName, previousValue);
    } catch (err) {
      return res.status(502).json({ error: `Could not update Infisical: ${err.message}` });
    }
  }

  // Swap in DB
  secrets.patch(keyName, { encrypted_previous_value: encryptedCurrent });

  res.json({ ok: true, message: 'Previous value restored' });
});

// ── DELETE /api/admin/secrets/:keyName ────────────────────────────────────────

router.delete('/secrets/:keyName', requireAdmin, async (req, res) => {
  const { keyName } = req.params;
  const { deleteFromInfisical = false } = req.body ?? {};

  const existing = secrets.getByKey(keyName);
  if (!existing) return res.status(404).json({ error: 'Secret not found' });

  if (deleteFromInfisical && existing.infisical_managed) {
    const infisicalStatus = getInfisicalStatus();
    if (infisicalStatus.connected) {
      try {
        await deleteInfisicalSecret(keyName);
      } catch (err) {
        console.warn(`[admin] Could not delete ${keyName} from Infisical:`, err.message);
        // Continue — remove from local DB even if Infisical fails
      }
    }
  }

  secrets.delete(keyName);
  res.json({ ok: true });
});

export default router;
