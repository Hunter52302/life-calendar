import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { users, userZk } from '../db/queries.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '30d';

function makeToken(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: TOKEN_TTL });
}

/**
 * GET /api/auth/status
 * Returns whether the app has been set up yet, and (if a valid token
 * is sent) whether that token is still good.
 */
router.get('/status', (req, res) => {
  const isSetup = users.count() > 0;
  const header = req.headers.authorization;
  let tokenValid = false;
  let zkData = null;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), SECRET);
      tokenValid = true;
      const zk = userZk.getStatus(payload.userId);
      if (zk) {
        zkData = {
          zk_enabled:    zk.zk_enabled === 1,
          kdf_salt:      zk.kdf_salt ?? null,
          zk_verify:     zk.zk_verify ?? null,
          user_timezone: zk.user_timezone ?? 'UTC',
        };
      }
    } catch { /* expired or invalid */ }
  }
  res.json({ isSetup, tokenValid, ...(zkData ?? {}) });
});

/**
 * POST /api/auth/setup
 * First-time password creation. Only works when no user exists yet.
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
  users.create(id, hash);
  res.json({ token: makeToken(id) });
});

/**
 * POST /api/auth/login
 * Body: { password: string }
 */
router.post('/login', async (req, res) => {
  const { password } = req.body;
  const user = users.getFirst();
  if (!user) {
    return res.status(404).json({ error: 'App not set up yet. Use /setup first.' });
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  res.json({ token: makeToken(user.id) });
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
