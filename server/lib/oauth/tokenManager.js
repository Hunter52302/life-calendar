/**
 * Returns a usable (decrypted, non-expired) access token for a stored calendar
 * connection, transparently refreshing + re-persisting if it's within the
 * expiry skew window. Tokens are encrypted at rest (tokenCrypto), so this is
 * the single place that decrypts them for outbound provider calls.
 */
import * as google from './google.js';
import * as microsoft from './microsoft.js';
import { encryptToken, decryptToken } from '../tokenCrypto.js';
import { pocketbaseCalendarConnections } from '../pocketbaseOperational.js';

const PROVIDERS = { google, microsoft };
const EXPIRY_SKEW_SECONDS = 60; // refresh a bit early to avoid mid-request expiry

export function getProvider(name) {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Unknown OAuth provider: ${name}`);
  return p;
}

/** @param connection a raw row from calendarConnections.getById (encrypted tokens). */
export async function getValidAccessToken(connection) {
  const provider = getProvider(connection.provider);
  const now = Math.floor(Date.now() / 1000);

  if (connection.token_expires_at - EXPIRY_SKEW_SECONDS > now) {
    return decryptToken(connection.access_token);
  }

  // Expired (or about to) — refresh using the stored refresh token.
  const refreshToken = decryptToken(connection.refresh_token);
  if (!refreshToken) throw new Error('No refresh token available; reconnect the calendar.');

  const refreshed = await provider.refreshAccessToken(refreshToken);
  const updates = {
    accessToken:    encryptToken(refreshed.accessToken),
    tokenExpiresAt: refreshed.expiresAt,
  };
  // Some providers (Microsoft) rotate the refresh token on use.
  if (refreshed.refreshToken) {
    updates.refreshToken = encryptToken(refreshed.refreshToken);
  }
  await pocketbaseCalendarConnections.updateTokens(connection.id, updates);
  return refreshed.accessToken;
}
