/**
 * "Sign in with Google" as a LINKED login provider.
 *
 * The LifeCalendar account is canonical; Google is an additive way to
 * authenticate into it. Password + recovery-key login stay fully zero-knowledge
 * — this adds one server-assisted door (see the migration + tokenManager notes).
 *
 * Flows
 * ─────
 * Link (must be signed in):
 *   GET  /link/connect   → { url } to Google consent (bundles calendar.readonly)
 *   GET  /link/callback  → verifies the Google `sub`, stages a pending link, and
 *                          (bonus) creates the encrypted calendar connection for
 *                          sync; bounces the SPA back with ?googleLink=pending
 *   POST /link/finalize  → client sends the DEK wrapped under a fresh random
 *                          secret; we commit the identity + store both
 *
 * Login (public):
 *   GET  /login/connect  → { url } to Google consent (identity only)
 *   GET  /login/callback → matches the `sub` to a linked user, mints a single-use
 *                          ticket, bounces ?googleTicket=<jwt>
 *   POST /login/complete → exchanges the ticket for the session token + the
 *                          Google unlock material (never placed in the URL)
 *
 * Management:
 *   GET    /status → { linked, google_email }
 *   DELETE /link   → unlink (wipes identity + the Google DEK wrap)
 *
 * Account matching is ONLY ever by verified `google_sub` — never by email, and
 * never auto-creating/merging — so a Google account can't take over a LifeCalendar
 * account. Linking requires an authenticated session.
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { callbackBaseUrl, frontendBaseUrl } from '../lib/oauth/urls.js';
import { encryptToken, decryptToken } from '../lib/tokenCrypto.js';
import * as google from '../lib/oauth/google.js';
import { pocketbaseUsers, pocketbaseGoogleTickets } from '../lib/pocketbaseInternal.js';
import { pocketbaseCalendarConnections } from '../lib/pocketbaseOperational.js';
import { makeToken, authPayload } from './auth.js';

const router = Router();
const SECRET = process.env.JWT_SECRET;
const STATE_TTL = '10m';
const TICKET_TTL = '2m';

const linkRedirectUri  = () => `${callbackBaseUrl()}/api/auth/google/link/callback`;
const loginRedirectUri = () => `${callbackBaseUrl()}/api/auth/google/login/callback`;

// Bounce the browser back to the SPA with a short status query the app reads.
function bounce(res, params) {
  const url = new URL(frontendBaseUrl() + '/');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  res.redirect(url.toString());
}

function signState(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: STATE_TTL });
}
function verifyState(token, purpose) {
  const p = jwt.verify(token, SECRET);
  if (p.purpose !== purpose) throw new Error('Wrong state purpose.');
  return p;
}

// ── Linking (authenticated) ─────────────────────────────────────────────────
router.get('/link/connect', requireAuth, (req, res) => {
  if (!google.isConfigured()) {
    return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
  }
  const state = signState({ userId: req.userId, purpose: 'google_link_state' });
  res.json({ url: google.buildAuthUrl(state, linkRedirectUri()) });
});

router.get('/link/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return bounce(res, { googleLinkError: String(error).slice(0, 200) });
  if (!code || !state) return bounce(res, { googleLinkError: 'Missing authorization code.' });

  let userId;
  try {
    ({ userId } = verifyState(String(state), 'google_link_state'));
  } catch {
    return bounce(res, { googleLinkError: 'This link expired. Please try again.' });
  }

  try {
    const tokens = await google.exchangeCode(String(code), linkRedirectUri());
    const identity = await google.fetchAccountIdentity(tokens.accessToken);

    // Refuse if this Google account already belongs to someone else.
    const existing = await pocketbaseUsers.getByGoogleSub(identity.sub);
    if (existing && existing.id !== userId) {
      return bounce(res, { googleLinkError: 'That Google account is already linked to another LifeCalendar account.' });
    }

    await pocketbaseUsers.setPendingGoogleLink(userId, { sub: identity.sub, email: identity.email });

    // Bonus: the same grant enables calendar sync. Needs a refresh token
    // (Google returns it with prompt=consent, which buildAuthUrl always sends).
    if (tokens.refreshToken) {
      await pocketbaseCalendarConnections.create(userId, {
        id: crypto.randomUUID(),
        provider: 'google',
        accountEmail: identity.email,
        accessToken:  encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
      }).catch(err => console.error('link calendar connection failed:', err.message));
    }

    bounce(res, { googleLink: 'pending' });
  } catch (err) {
    console.error('google link callback failed:', err.message);
    bounce(res, { googleLinkError: 'Could not link Google. Please try again.' });
  }
});

router.post('/link/finalize', requireAuth, async (req, res) => {
  const { wrappedDekGoogle, googleUnlockSecret } = req.body ?? {};
  if (typeof wrappedDekGoogle !== 'string' || typeof googleUnlockSecret !== 'string') {
    return res.status(400).json({ error: 'Missing Google unlock material.' });
  }

  const user = await pocketbaseUsers.getById(req.userId);
  if (!user?.pending_google_sub) {
    return res.status(400).json({ error: 'No pending Google link. Start linking again.' });
  }
  if (!user.pending_google_expires || user.pending_google_expires < Math.floor(Date.now() / 1000)) {
    return res.status(400).json({ error: 'This link attempt expired. Please try again.' });
  }
  // Re-check for a race between the callback and this finalize.
  const existing = await pocketbaseUsers.getByGoogleSub(user.pending_google_sub);
  if (existing && existing.id !== req.userId) {
    return res.status(409).json({ error: 'That Google account is already linked to another account.' });
  }

  await pocketbaseUsers.commitGoogleLink(req.userId, {
    sub: user.pending_google_sub,
    email: user.pending_google_email,
    wrappedDekGoogle,
    googleUnlockSecret: encryptToken(googleUnlockSecret), // encrypted at rest
  });
  res.json({ ok: true, google_email: user.pending_google_email });
});

// ── Login (public) ───────────────────────────────────────────────────────────
router.get('/login/connect', (req, res) => {
  if (!google.isConfigured()) {
    return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
  }
  const state = signState({ purpose: 'google_login_state' });
  res.json({ url: google.buildLoginAuthUrl(state, loginRedirectUri()) });
});

router.get('/login/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return bounce(res, { googleLoginError: String(error).slice(0, 200) });
  if (!code || !state) return bounce(res, { googleLoginError: 'missing_code' });

  try {
    verifyState(String(state), 'google_login_state');
  } catch {
    return bounce(res, { googleLoginError: 'expired' });
  }

  try {
    const tokens = await google.exchangeCode(String(code), loginRedirectUri());
    const identity = await google.fetchAccountIdentity(tokens.accessToken);

    const user = await pocketbaseUsers.getByGoogleSub(identity.sub);
    if (!user) return bounce(res, { googleLoginError: 'not_linked' });
    if (user.is_blocked) return bounce(res, { googleLoginError: 'blocked' });

    const jti = crypto.randomUUID();
    await pocketbaseGoogleTickets.create(user.id, jti);
    const ticket = jwt.sign({ jti, purpose: 'google_login_ticket' }, SECRET, { expiresIn: TICKET_TTL });
    bounce(res, { googleTicket: ticket });
  } catch (err) {
    console.error('google login callback failed:', err.message);
    bounce(res, { googleLoginError: 'failed' });
  }
});

router.post('/login/complete', authLimiter, async (req, res) => {
  const { ticket } = req.body ?? {};
  let jti;
  try {
    const p = jwt.verify(String(ticket ?? ''), SECRET);
    if (p.purpose !== 'google_login_ticket') throw new Error('wrong purpose');
    jti = p.jti;
  } catch {
    return res.status(401).json({ error: 'This sign-in link is invalid or expired. Please try again.' });
  }

  const userId = await pocketbaseGoogleTickets.consume(jti); // single-use
  if (!userId) return res.status(401).json({ error: 'This sign-in link expired. Please try again.' });

  const user = await pocketbaseUsers.getById(userId);
  if (!user || user.is_blocked) {
    return res.status(403).json({ error: 'This account is not available.' });
  }
  if (!user.wrapped_dek_google || !user.google_unlock_secret) {
    return res.status(400).json({ error: 'Google sign-in is not set up for this account.' });
  }

  await pocketbaseUsers.resetLoginAttempts(user.id);
  res.json({
    ...authPayload(user),
    wrapped_dek_google:   user.wrapped_dek_google,
    google_unlock_secret: decryptToken(user.google_unlock_secret),
  });
});

// ── Management (authenticated) ────────────────────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
  const user = await pocketbaseUsers.getById(req.userId);
  res.json({ linked: !!user?.google_sub, google_email: user?.google_email ?? null });
});

router.delete('/link', requireAuth, async (req, res) => {
  await pocketbaseUsers.clearGoogleLink(req.userId);
  res.json({ ok: true });
});

export default router;
