/**
 * Admin routes — all under /api/admin/
 *
 * Zero-trust account panel (role-based, gated by requireAdmin):
 *   GET    /api/admin/users                     list accounts (email + status only)
 *   GET    /api/admin/audit-log                 recent admin actions
 *   GET    /api/admin/signup-clusters            IPs that registered more than one account
 *   POST   /api/admin/users/:id/reset-password   set a user's password
 *   PUT    /api/admin/users/:id/block            block/unblock a user
 *   DELETE /api/admin/users/:id                  delete an account and all its data
 *
 * Secrets panel — gated by requireElevatedAdmin on top of the router-level
 * requireAdmin (a leaked regular session token alone is not enough to touch secrets):
 *   POST   /api/admin/auth                       issues a 1h elevated admin JWT (re-enter password)
 *   GET    /api/admin/secrets                     list all secret metadata
 *   POST   /api/admin/secrets                     register + create in Infisical
 *   PUT    /api/admin/secrets/:keyName            rotate value (saves previous)
 *   DELETE /api/admin/secrets/:keyName            unregister (optionally from Infisical)
 *   POST   /api/admin/secrets/:keyName/restore    restore previous value
 *   GET    /api/admin/infisical/status            connection status
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAuth, requireAdmin, requireElevatedAdmin } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimit.js';
import { users, adminAuditLog, secrets } from '../db/queries.js';
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
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_TTL = '1h';

router.use(adminLimiter, requireAuth, requireAdmin);

// ── Account panel ─────────────────────────────────────────────────────────────

/** GET /api/admin/users — list accounts (email + status only). */
router.get('/users', (req, res) => {
  res.json(users.listAll());
});

/** GET /api/admin/audit-log — recent admin actions (who did what, to whom, when). */
router.get('/audit-log', (req, res) => {
  res.json(adminAuditLog.listRecent());
});

/** GET /api/admin/signup-clusters — IPs that registered more than one account (bot-farm signal). */
router.get('/signup-clusters', (req, res) => {
  res.json(users.getSignupIpClusters());
});

/**
 * POST /api/admin/users/:id/reset-password
 * Disabled under zero-knowledge: the server can't re-wrap a user's data key
 * without their password or recovery code, so an admin literally cannot reset a
 * password without permanently locking the user out of their encrypted data.
 * Users recover themselves with their one-time recovery code (/auth/reset-password).
 */
router.post('/users/:id/reset-password', (req, res) => {
  return res.status(409).json({
    error: 'Password reset is not possible under zero-knowledge encryption. ' +
           'The user must reset their own password using their recovery code.',
  });
});

/**
 * PUT /api/admin/users/:id/block
 * Body: { blocked: boolean }
 */
router.put('/users/:id/block', (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'You cannot block your own account.' });
  }
  const target = users.getById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const blocked = !!req.body?.blocked;
  users.setBlocked(target.id, blocked);
  adminAuditLog.record(req.userId, blocked ? 'block' : 'unblock', target.id);
  res.json({ ok: true });
});

/** DELETE /api/admin/users/:id — removes the account and all its data (FK cascade). */
router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }
  const target = users.getById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  adminAuditLog.record(req.userId, 'delete', target.id);
  users.deleteUser(target.id);
  res.json({ ok: true });
});

// ── Secrets panel helpers ─────────────────────────────────────────────────────

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
// Re-authenticate the current (already-admin) user and get a short-lived
// elevated admin token, required to touch secrets.

router.post('/auth', async (req, res) => {
  const { password } = req.body ?? {};
  if (!password) return res.status(400).json({ error: 'password is required' });

  const user = users.getById(req.userId);
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

router.get('/infisical/status', requireElevatedAdmin, (_req, res) => {
  res.json(getInfisicalStatus());
});

// ── GET /api/admin/secrets ────────────────────────────────────────────────────

router.get('/secrets', requireElevatedAdmin, async (_req, res) => {
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

router.post('/secrets', requireElevatedAdmin, async (req, res) => {
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

router.put('/secrets/:keyName', requireElevatedAdmin, async (req, res) => {
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

router.post('/secrets/:keyName/restore', requireElevatedAdmin, async (req, res) => {
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

router.delete('/secrets/:keyName', requireElevatedAdmin, async (req, res) => {
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
