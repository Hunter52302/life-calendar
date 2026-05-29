import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

/**
 * Express middleware that verifies the Bearer token and attaches
 * `req.userId` so routes don't have to repeat this logic.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Elevated middleware for admin-only routes.
 * Requires an admin JWT (issued by POST /api/admin/auth, 1h TTL)
 * which carries { userId, isAdmin: true }.
 *
 * Regular user tokens (no isAdmin claim) are rejected with 403.
 */
export function requireAdmin(req, res, next) {
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
