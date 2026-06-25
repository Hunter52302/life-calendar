/**
 * OAuth `state` parameter — CSRF protection that also carries which user
 * initiated the connect flow.
 *
 * The OAuth callback is a top-level browser navigation from the provider, so
 * it does NOT carry the SPA's Authorization header — the server can't read the
 * bearer token there. We therefore bind the requesting user's id into a signed,
 * short-lived state token at /connect time (which IS authenticated) and trust
 * only that on the callback. An attacker cannot forge it without JWT_SECRET,
 * and it expires quickly so a leaked URL can't be replayed later.
 */
import jwt from 'jsonwebtoken';

const STATE_TTL = '10m';

export function signState({ userId, provider }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to sign OAuth state.');
  return jwt.sign({ userId, provider, purpose: 'oauth_state' }, secret, { expiresIn: STATE_TTL });
}

/** Returns { userId, provider }. Throws if invalid/expired/wrong-purpose. */
export function verifyState(token, expectedProvider) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to verify OAuth state.');
  const payload = jwt.verify(token, secret);
  if (payload.purpose !== 'oauth_state') throw new Error('Not an OAuth state token.');
  if (expectedProvider && payload.provider !== expectedProvider) {
    throw new Error('OAuth state provider mismatch.');
  }
  return { userId: payload.userId, provider: payload.provider };
}
