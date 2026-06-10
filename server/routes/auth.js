import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { users, userZk } from '../db/queries.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '30d';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeToken(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: TOKEN_TTL });
}

/** ZK fields + identity the client needs right after auth. */
function authPayload(user) {
  return {
    token:      makeToken(user.id),
    role:       user.role ?? 'user',
    email:      user.email ?? null,
    zk_enabled: user.zk_enabled === 1,
    kdf_salt:   user.kdf_salt ?? null,
    zk_verify:  user.zk_verify ?? null,
  };
}

/**
 * GET /api/auth/status
 * Returns whether any account exists yet, and (if a valid token is sent)
 * whether that token is still good plus the account's ZK material.
 */
router.get('/status', (req, res) => {
  const isSetup = users.count() > 0;
  const header = req.headers.authorization;
  let tokenValid = false;
  let extra = null;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), SECRET);
      const user = users.getById(payload.userId);
      if (user && !user.is_blocked) {
        tokenValid = true;
        extra = {
          role:          user.role ?? 'user',
          email:         user.email ?? null,
          zk_enabled:    user.zk_enabled === 1,
          kdf_salt:      user.kdf_salt ?? null,
          zk_verify:     user.zk_verify ?? null,
          user_timezone: user.user_timezone ?? 'UTC',
        };
      }
    } catch { /* expired or invalid */ }
  }
  res.json({ isSetup, tokenValid, ...(extra ?? {}) });
});

/**
 * POST /api/auth/register
 * Creates a new account. The first account ever becomes the admin.
 * Zero-knowledge encryption is set up at registration: the client derives
 * the key locally and sends only the salt + verification blob.
 * Body: { email, password, kdf_salt?, zk_verify? }
 */
router.post('/register', async (req, res) => {
  const { email, password, kdf_salt, zk_verify } = req.body ?? {};
  const normEmail = email?.trim().toLowerCase();

  if (!normEmail || !EMAIL_RE.test(normEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (users.getByEmail(normEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password, 12);
  const role = users.count() === 0 ? 'admin' : 'user';
  users.create(id, hash, {
    email: normEmail,
    role,
    kdfSalt: kdf_salt ?? null,
    zkVerify: zk_verify ?? null,
  });
  res.json(authPayload(users.getById(id)));
});

/**
 * POST /api/auth/setup
 * Legacy first-time password creation (kept for the mobile app).
 * Only works when no user exists yet.
 * Body: { password: string }
 */
router.post('/setup', async (req, res) => {
  if (users.count() > 0) {
    return res.status(409).json({ error: 'App is already set up. Use /login instead.' });
  }
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }
  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password, 12);
  users.create(id, hash, { role: 'admin' });
  res.json({ token: makeToken(id) });
});

/**
 * POST /api/auth/login
 * Body: { email?: string, password: string }
 * Email is required once more than one account exists. When omitted, falls
 * back to the legacy single account created before emails existed (this
 * also keeps the mobile app's password-only login working).
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!password) return res.status(400).json({ error: 'Password is required.' });

  let user;
  if (email?.trim()) {
    user = users.getByEmail(email.trim().toLowerCase());
  } else {
    const legacy = users.getLegacyUsers();
    if (legacy.length === 1 && users.count() === 1) {
      user = legacy[0];
    } else if (users.count() === 0) {
      return res.status(404).json({ error: 'No account exists yet. Create one first.' });
    } else {
      return res.status(400).json({ error: 'Email is required.' });
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (user.is_blocked) {
    return res.status(403).json({ error: 'This account has been blocked. Contact the administrator.' });
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  res.json(authPayload(user));
});

/**
 * PUT /api/auth/email
 * Lets a legacy account (or anyone) set/change their login email.
 * Body: { email: string }
 */
router.put('/email', requireAuth, (req, res) => {
  const normEmail = req.body?.email?.trim().toLowerCase();
  if (!normEmail || !EMAIL_RE.test(normEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  const existing = users.getByEmail(normEmail);
  if (existing && existing.id !== req.userId) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  users.setEmail(req.userId, normEmail);
  res.json({ ok: true, email: normEmail });
});

/**
 * PUT /api/auth/zk-enable
 * Enables zero-knowledge encryption for the authenticated user.
 * Body: { kdf_salt: hex string, zk_verify: base64 string }
 */
router.put('/zk-enable', requireAuth, (req, res) => {
  const { kdf_salt, zk_verify } = req.body;
  if (!kdf_salt || !zk_verify) {
    return res.status(400).json({ error: 'kdf_salt and zk_verify are required' });
  }
  userZk.enableZk(req.userId, kdf_salt, zk_verify);
  res.json({ ok: true });
});

/**
 * PUT /api/auth/timezone
 * Updates the user's timezone for notification scheduling.
 * Body: { timezone: IANA string }
 */
router.put('/timezone', requireAuth, (req, res) => {
  const { timezone } = req.body;
  if (!timezone) return res.status(400).json({ error: 'timezone required' });
  userZk.setTimezone(req.userId, timezone);
  res.json({ ok: true });
});

export default router;
