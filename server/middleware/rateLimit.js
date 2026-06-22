import rateLimit from 'express-rate-limit';

/** Login/register: bot-signup and brute-force defense. 10 attempts / 15 min / IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

/** Admin API: tighter, since it's a high-value target. 60 requests / 15 min / IP. */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Please try again later.' },
});
