/**
 * Builds an OAuth connect/callback router for a given provider module
 * (google.js / microsoft.js). Both providers share identical flow logic;
 * only the provider-specific URL/token details differ, and those live in the
 * provider module.
 *
 *   GET /connect   (authenticated) → { url } to redirect the user to
 *   GET /callback  (public)        → exchanges the code, stores an encrypted
 *                                     connection, redirects back to the SPA
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { signState, verifyState } from '../lib/oauth/state.js';
import { redirectUriFor, frontendBaseUrl } from '../lib/oauth/urls.js';
import { encryptToken } from '../lib/tokenCrypto.js';
import { calendarConnections } from '../db/queries.js';

export function createOAuthRouter(provider) {
  const router = Router();
  const name = provider.PROVIDER;

  // Bounce the browser back to the SPA with a short status query the app reads.
  const bounce = (res, params) => {
    const url = new URL(frontendBaseUrl() + '/');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    res.redirect(url.toString());
  };

  router.get('/connect', requireAuth, (req, res) => {
    if (!provider.isConfigured()) {
      return res.status(503).json({ error: `${name} calendar sync is not configured on this server.` });
    }
    const state = signState({ userId: req.userId, provider: name });
    res.json({ url: provider.buildAuthUrl(state, redirectUriFor(name)) });
  });

  router.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error) return bounce(res, { connectError: String(error).slice(0, 200) });
    if (!code || !state) return bounce(res, { connectError: 'Missing authorization code.' });

    let userId;
    try {
      ({ userId } = verifyState(String(state), name));
    } catch {
      // Forged / expired / replayed state — refuse without touching any account.
      return bounce(res, { connectError: 'This sign-in link expired. Please try again.' });
    }

    try {
      const tokens = await provider.exchangeCode(String(code), redirectUriFor(name));
      if (!tokens.refreshToken) {
        // Without a refresh token we can't keep syncing; ask the user to retry
        // (Google only returns it with prompt=consent, which we always send).
        return bounce(res, { connectError: 'No refresh token returned. Please reconnect and grant offline access.' });
      }
      const accountEmail = await provider.fetchAccountEmail(tokens.accessToken).catch(() => null);
      const conn = calendarConnections.create(userId, {
        provider: name,
        accountEmail,
        accessToken:    encryptToken(tokens.accessToken),
        refreshToken:   encryptToken(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scope:          tokens.scope,
      });
      bounce(res, { connected: name, connectionId: conn.id });
    } catch (err) {
      console.error(`${name} OAuth callback failed:`, err.message);
      bounce(res, { connectError: 'Could not connect the calendar. Please try again.' });
    }
  });

  return router;
}
