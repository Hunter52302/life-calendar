/**
 * Authenticated PocketBase client for the Express bridge.
 *
 * SECURITY MODEL
 * --------------
 * Every collection's API rules are locked to superuser-only (see the
 * `lock_collection_rules` migration). PocketBase is therefore NOT reachable
 * without a superuser token — closing the previous hole where the collections
 * were world-readable/writable (rules were ""), which exposed every user's
 * auth envelope (bcrypt hashes, salts, wrapped DEKs), secrets, and data to
 * anyone who could reach the PocketBase port.
 *
 * The Express server is the only PocketBase client. It authenticates once as a
 * superuser and reuses the token for all record operations, re-authenticating
 * transparently on expiry (401). Superusers bypass collection API rules, so the
 * bridge keeps working while the data layer stays closed to everyone else.
 *
 * OPERATOR SETUP (one-time):
 *   1. Create the superuser:
 *        ./pocketbase/pocketbase superuser upsert <email> <password>
 *   2. Put the same credentials in the server env:
 *        POCKETBASE_ADMIN_EMAIL=<email>
 *        POCKETBASE_ADMIN_PASSWORD=<password>
 */

const PB_BASE = (process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');

// Refresh the cached token well before PocketBase's default TTL. We also always
// re-auth on a 401, so this interval is just a proactive backstop.
const TOKEN_REFRESH_MS = 10 * 60 * 1000;

let cachedToken = null;
let tokenExpiresAt = 0; // epoch ms
let inFlightAuth = null; // de-dupe concurrent auth calls

function readCreds() {
  const identity = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;
  if (!identity || !password) {
    throw new Error(
      'PocketBase superuser credentials are not configured. Set POCKETBASE_ADMIN_EMAIL ' +
      'and POCKETBASE_ADMIN_PASSWORD in the server env. Create the superuser with: ' +
      './pocketbase/pocketbase superuser upsert <email> <password>'
    );
  }
  return { identity, password };
}

async function authenticate() {
  const { identity, password } = readCreds();
  const res = await fetch(`${PB_BASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, password }),
  });
  if (!res.ok) {
    let detail = String(res.status);
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    throw new Error(`PocketBase superuser auth failed: ${detail}`);
  }
  const data = await res.json();
  cachedToken = data.token;
  tokenExpiresAt = Date.now() + TOKEN_REFRESH_MS;
  return cachedToken;
}

async function getToken(forceRefresh = false) {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  // Collapse concurrent (re)auth attempts into a single request.
  if (!inFlightAuth) {
    inFlightAuth = authenticate().finally(() => { inFlightAuth = null; });
  }
  return inFlightAuth;
}

/**
 * fetch() wrapper that injects the superuser token + JSON content-type and
 * transparently re-authenticates once on a 401 (expired/rotated token).
 * Returns the raw Response — callers keep their existing status handling.
 */
export async function pbAuthedFetch(path, options = {}) {
  const send = (token) => fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
      Authorization: token,
    },
  });

  let res = await send(await getToken());
  if (res.status === 401) {
    res = await send(await getToken(true));
  }
  return res;
}

export { PB_BASE };
