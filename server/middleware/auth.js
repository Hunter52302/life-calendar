import jwt from 'jsonwebtoken';
import { pocketbaseUsers } from '../lib/pocketbaseInternal.js';

const SECRET = process.env.JWT_SECRET;

/**
 * Express middleware that verifies the Bearer token and attaches
 * `req.userId` / `req.userRole` so routes don't have to repeat this logic.
 * Blocked or deleted accounts are rejected even with a valid token.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET);
    const user = await pocketbaseUsers.getById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Account is blocked' });
    }
    req.userId = user.id;
    req.userRole = user.role ?? 'user';
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Use after requireAuth. Rejects non-admin accounts. */
export function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Elevated middleware for the most sensitive admin routes (server secrets).
 * Requires a short-lived admin JWT (issued by POST /api/admin/auth, 1h TTL,
 * after re-entering your password) carrying { userId, isAdmin: true } — a
 * leaked regular session token alone is not enough to touch secrets.
 */
export function requireElevatedAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET);
    if (!payload.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}
