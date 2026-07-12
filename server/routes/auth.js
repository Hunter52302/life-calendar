import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pocketbaseUsers, pocketbaseUserZk } from '../lib/pocketbaseInternal.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();
const SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '30d';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFIER_RE = /^[0-9a-f]{64}$/; // 32-byte hex from zkEnvelope.deriveAuthVerifier
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Envelope ZK (Model B): the server NEVER receives the password. The client
 * derives an auth verifier (sent here, bcrypt-stored) and a key-encryption key
 * (never sent). Login returns the wrapped DEK so the client can unlock locally.
 */

/**
 * Optional bot-signup defense. Only enforced when TURNSTILE_SECRET is set.
 */
async function verifyTurnstile(token) {
  if (!process.env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: token }),
    });
    const data = await resp.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export function makeToken(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: TOKEN_TTL });
}

/** Identity + unlock material the client needs right after authenticating. */
export function authPayload(user) {
  return {
    token:                makeToken(user.id),
    role:                 user.role ?? 'user',
    email:                user.email ?? null,
    auth_salt:            user.auth_salt ?? null,
    kdf_salt:             user.kdf_salt ?? null,
    wrapped_dek_password: user.wrapped_dek_password ?? null,
  };
}

/**
 * Deterministic, realistic-looking salt for an email that has no account, so
 * /prelogin and /recovery-envelope can't be used to enumerate which emails are
 * registered. Same email always yields the same fake salt (HMAC over the
 * server secret), and it's indistinguishable from a real random salt.
 */
function fakeSalt(email, label) {
  // Take the first 16 bytes of the HMAC and base64-encode them, so the output
  // is byte-for-byte the same shape as generateSalt() (toB64 of 16 bytes →
  // 24 chars ending in '=='). Slicing the base64 string instead would drop the
  // '==' padding and make fake salts distinguishable from real ones — an
  // account-enumeration oracle.
  return crypto.createHmac('sha256', SECRET)
    .update(`${label}:${email.toLowerCase()}`)
    .digest()
    .subarray(0, 16)
    .toString('base64');
}

/**
 * GET /api/auth/status
 * Whether any account exists, and (with a valid token) the account identity +
 * unlock envelope so a reloaded client can re-derive its key.
 */
router.get('/status', asyncHandler(async (req, res) => {
  const isSetup = (await pocketbaseUsers.count()) > 0;
  const header = req.headers.authorization;
  let tokenValid = false;
  let extra = null;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), SECRET);
      const user = await pocketbaseUsers.getById(payload.userId);
      if (user && !user.is_blocked) {
        tokenValid = true;
        extra = {
          role:                 user.role ?? 'user',
          email:                user.email ?? null,
          auth_salt:            user.auth_salt ?? null,
          kdf_salt:             user.kdf_salt ?? null,
          wrapped_dek_password: user.wrapped_dek_password ?? null,
          user_timezone:        user.user_timezone ?? 'UTC',
        };
      }
    } catch { /* expired or invalid */ }
  }
  res.json({ isSetup, tokenValid, ...(extra ?? {}) });
}));

/**
 * POST /api/auth/prelogin
 * Body: { email }
 * Returns the salts the client needs to derive its auth verifier + KEK. Always
 * 200 with realistic salts (fake for unknown emails) to prevent enumeration.
 */
router.post('/prelogin', authLimiter, asyncHandler(async (req, res) => {
  const email = req.body?.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  const user = await pocketbaseUsers.getByEmail(email);
  if (user && user.auth_salt && user.kdf_salt) {
    return res.json({ auth_salt: user.auth_salt, kdf_salt: user.kdf_salt });
  }
  res.json({ auth_salt: fakeSalt(email, 'auth'), kdf_salt: fakeSalt(email, 'kdf') });
}));

/**
 * POST /api/auth/register
 * Body: { email, authVerifier, envelope, turnstile_token? }
 *   envelope: { authSalt, kdfSalt, recoverySalt, recoveryAuthSalt,
 *               recoveryVerifier, wrappedDekPassword, wrappedDekRecovery }
 * The first account ever becomes the admin. The server stores bcrypt(verifier)
 * and bcrypt(recoveryVerifier) — never the password or recovery code.
 */
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { email, authVerifier, envelope, turnstile_token } = req.body ?? {};
  const normEmail = email?.trim().toLowerCase();

  if (!(await verifyTurnstile(turnstile_token))) {
    return res.status(400).json({ error: 'Bot verification failed. Please try again.' });
  }
  if (!normEmail || !EMAIL_RE.test(normEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!VERIFIER_RE.test(authVerifier ?? '')) {
    return res.status(400).json({ error: 'Invalid authentication material.' });
  }
  if (!envelope || !envelope.kdfSalt || !envelope.authSalt || !envelope.wrappedDekPassword ||
      !envelope.wrappedDekRecovery || !envelope.recoverySalt || !envelope.recoveryAuthSalt ||
      !VERIFIER_RE.test(envelope.recoveryVerifier ?? '')) {
    return res.status(400).json({ error: 'Incomplete encryption envelope.' });
  }
  if (await pocketbaseUsers.getByEmail(normEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const id = crypto.randomUUID();
  const role = (await pocketbaseUsers.count()) === 0 ? 'admin' : 'user';
  const [verifierHash, recoveryVerifierHash] = await Promise.all([
    bcrypt.hash(authVerifier, 12),
    bcrypt.hash(envelope.recoveryVerifier, 12),
  ]);
  await pocketbaseUsers.create(id, verifierHash, {
    email: normEmail,
    role,
    signupIp: req.ip ?? null,
    env: {
      authSalt:           envelope.authSalt,
      kdfSalt:            envelope.kdfSalt,
      recoverySalt:       envelope.recoverySalt,
      recoveryAuthSalt:   envelope.recoveryAuthSalt,
      recoveryVerifierHash,
      wrappedDekPassword: envelope.wrappedDekPassword,
      wrappedDekRecovery: envelope.wrappedDekRecovery,
    },
  });
  res.json(authPayload(await pocketbaseUsers.getById(id)));
}));

/**
 * POST /api/auth/login
 * Body: { email, authVerifier }
 */
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { email, authVerifier } = req.body ?? {};
  const normEmail = email?.trim().toLowerCase();
  if (!normEmail || !VERIFIER_RE.test(authVerifier ?? '')) {
    return res.status(400).json({ error: 'Invalid email or password.' });
  }

  const user = await pocketbaseUsers.getByEmail(normEmail);
  // Compare against a dummy hash for unknown users so timing doesn't leak existence.
  const hash = user?.password_hash ?? '$2a$12$0000000000000000000000000000000000000000000000000000a';

  if (user?.is_blocked) {
    return res.status(403).json({ error: 'This account has been blocked. Contact the administrator.' });
  }
  if (user?.locked_until && user.locked_until > Math.floor(Date.now() / 1000)) {
    const minutes = Math.ceil((user.locked_until - Date.now() / 1000) / 60);
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${minutes} minute(s).` });
  }

  const match = await bcrypt.compare(authVerifier, hash);
  if (!user || !match) {
    if (user) await pocketbaseUsers.recordFailedLogin(user.id);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  await pocketbaseUsers.resetLoginAttempts(user.id);
  res.json(authPayload(user));
}));

/**
 * POST /api/auth/recovery-envelope
 * Body: { email }
 * Returns the recovery-side material so the client can unwrap the DEK with the
 * user's recovery code and build a reset. Enumeration-safe (fake for unknown).
 */
router.post('/recovery-envelope', authLimiter, asyncHandler(async (req, res) => {
  const email = req.body?.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  const user = await pocketbaseUsers.getByEmail(email);
  if (user?.recovery_salt && user?.wrapped_dek_recovery) {
    return res.json({
      recovery_salt:        user.recovery_salt,
      recovery_auth_salt:   user.recovery_auth_salt,
      wrapped_dek_recovery: user.wrapped_dek_recovery,
    });
  }
  // Fake but realistic — wrapped blob shape can't be faithfully forged, so we
  // return a plausible-looking encrypted blob the client will simply fail to
  // unwrap (same observable outcome as a wrong recovery code).
  res.json({
    recovery_salt:        fakeSalt(email, 'rec'),
    recovery_auth_salt:   fakeSalt(email, 'recauth'),
    wrapped_dek_recovery: 'zk1:' + crypto.randomBytes(60).toString('base64'),
  });
}));

/**
 * POST /api/auth/reset-password
 * Body: { email, recoveryVerifier, envelope: { authVerifier, authSalt, kdfSalt, wrappedDekPassword } }
 * The client proves it holds the recovery code (recoveryVerifier) and supplies a
 * DEK freshly re-wrapped under the new password. Server never sees either secret.
 */
router.post('/reset-password', authLimiter, asyncHandler(async (req, res) => {
  const { email, recoveryVerifier, envelope } = req.body ?? {};
  const normEmail = email?.trim().toLowerCase();
  if (!normEmail || !VERIFIER_RE.test(recoveryVerifier ?? '')) {
    return res.status(400).json({ error: 'Invalid recovery code.' });
  }
  if (!envelope || !VERIFIER_RE.test(envelope.authVerifier ?? '') ||
      !envelope.authSalt || !envelope.kdfSalt || !envelope.wrappedDekPassword) {
    return res.status(400).json({ error: 'Incomplete reset envelope.' });
  }

  const user = await pocketbaseUsers.getByEmail(normEmail);
  const recHash = user?.recovery_verifier ?? '$2a$12$0000000000000000000000000000000000000000000000000000a';
  const ok = await bcrypt.compare(recoveryVerifier, recHash);
  if (!user || !ok) {
    return res.status(401).json({ error: 'That recovery code is not valid for this account.' });
  }

  const verifierHash = await bcrypt.hash(envelope.authVerifier, 12);
  await pocketbaseUsers.setPasswordEnvelope(user.id, {
    verifierHash,
    authSalt:           envelope.authSalt,
    kdfSalt:            envelope.kdfSalt,
    wrappedDekPassword: envelope.wrappedDekPassword,
  });
  res.json(authPayload(await pocketbaseUsers.getById(user.id)));
}));

/**
 * PUT /api/auth/email — set/change login email.
 */
router.put('/email', requireAuth, asyncHandler(async (req, res) => {
  const normEmail = req.body?.email?.trim().toLowerCase();
  if (!normEmail || !EMAIL_RE.test(normEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  const existing = await pocketbaseUsers.getByEmail(normEmail);
  if (existing && existing.id !== req.userId) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  await pocketbaseUsers.setEmail(req.userId, normEmail);
  res.json({ ok: true, email: normEmail });
}));

/**
 * PUT /api/auth/timezone — update timezone for notification scheduling.
 */
router.put('/timezone', requireAuth, asyncHandler(async (req, res) => {
  const { timezone } = req.body;
  if (!timezone) return res.status(400).json({ error: 'timezone required' });
  await pocketbaseUserZk.setTimezone(req.userId, timezone);
  res.json({ ok: true });
}));

/**
 * DELETE /api/auth/account
 * Body: { authVerifier }
 * Permanently removes the current account and all owned data after password proof.
 */
router.delete('/account', authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const { authVerifier } = req.body ?? {};
  if (!VERIFIER_RE.test(authVerifier ?? '')) {
    return res.status(400).json({ error: 'Password confirmation is required.' });
  }

  const user = await pocketbaseUsers.getById(req.userId);
  const ok = await bcrypt.compare(authVerifier, user?.password_hash ?? '');
  if (!user || !ok) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  await pocketbaseUsers.deleteUser(user.id);
  res.json({ ok: true, isSetup: (await pocketbaseUsers.count()) > 0 });
}));

export default router;
