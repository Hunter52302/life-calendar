import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { users } from '../db/queries.js';

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
  if (header?.startsWith('Bearer ')) {
    try {
      jwt.verify(header.slice(7), SECRET);
      tokenValid = true;
    } catch { /* expired or invalid */ }
  }
  res.json({ isSetup, tokenValid });
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

export default router;
