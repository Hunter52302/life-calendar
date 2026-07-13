/**
 * Google Calendar OAuth + read-only event fetch.
 *
 * Read-only scope (calendar.readonly) — we only import events, never write.
 * access_type=offline + prompt=consent so Google returns a refresh_token the
 * first time (without prompt=consent a re-auth often omits it).
 */
const AUTH_URL      = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL     = 'https://oauth2.googleapis.com/token';
const USERINFO_URL  = 'https://www.googleapis.com/oauth2/v2/userinfo';
const CAL_LIST_URL  = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.readonly';

export const PROVIDER = 'google';

export function isConfigured() {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

function config() {
  return {
    clientId:     process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  };
}

export function buildAuthUrl(state, redirectUri) {
  const { clientId } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Lightweight identity-only auth URL for "Sign in with Google". No calendar
 * scope, no offline access / forced consent — the user already consented when
 * they linked, so re-auth stays a quick round-trip that just proves the `sub`.
 */
const LOGIN_SCOPES = 'openid email';
export function buildLoginAuthUrl(state, redirectUri) {
  const { clientId } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: LOGIN_SCOPES,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code, redirectUri) {
  const { clientId, clientSecret } = config();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const t = await res.json();
  return {
    accessToken:  t.access_token,
    refreshToken: t.refresh_token ?? null,
    expiresAt:    Math.floor(Date.now() / 1000) + (t.expires_in ?? 3600),
    scope:        t.scope ?? SCOPES,
  };
}

export async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = config();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId,
      client_secret: clientSecret, grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status})`);
  const t = await res.json();
  return {
    accessToken: t.access_token,
    expiresAt:   Math.floor(Date.now() / 1000) + (t.expires_in ?? 3600),
  };
}

export async function fetchAccountEmail(accessToken) {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const j = await res.json();
  return j.email ?? null;
}

/**
 * Identity for the login/link flow: the stable Google account id (`sub`) plus
 * the email. `sub` is what we match on at sign-in — never the email, which can
 * change or be reassigned. Throws if userinfo can't be read (no `sub` = we must
 * refuse rather than guess an identity).
 */
export async function fetchAccountIdentity(accessToken) {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Google userinfo failed (${res.status})`);
  const j = await res.json();
  if (!j.id) throw new Error('Google userinfo returned no account id.');
  return { sub: String(j.id), email: j.email ?? null };
}

export async function listCalendars(accessToken) {
  const res = await fetch(CAL_LIST_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Google calendar list failed (${res.status})`);
  const j = await res.json();
  return (j.items ?? []).map(c => ({
    id: c.id,
    name: c.summaryOverride || c.summary || c.id,
    primary: !!c.primary,
  }));
}

/** Fetch events in [timeMin, timeMax] (ISO strings) and normalize to the common shape. */
export async function listEvents(accessToken, calendarId, timeMin, timeMax) {
  const out = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      singleEvents: 'true', orderBy: 'startTime',
      timeMin, timeMax, maxResults: '2500',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Google events fetch failed (${res.status})`);
    const j = await res.json();
    for (const e of j.items ?? []) {
      if (e.status === 'cancelled') continue;
      const allDay = !!e.start?.date;
      out.push({
        id: e.id,
        title: e.summary || '(no title)',
        start: allDay ? e.start.date : e.start?.dateTime,
        end:   allDay ? e.end?.date  : e.end?.dateTime,
        allDay,
        notes: e.description ?? null,
        // Instances of a recurring event (singleEvents:true expands them) all
        // carry the master's id here — the app groups them into one series.
        seriesId: e.recurringEventId ?? null,
      });
    }
    pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}
