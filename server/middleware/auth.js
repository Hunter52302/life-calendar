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
