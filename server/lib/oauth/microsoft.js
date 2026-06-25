/**
 * Microsoft (Outlook / Microsoft 365) Calendar OAuth + read-only event fetch
 * via Microsoft Graph.
 *
 * "common" tenant so both work and personal Microsoft accounts can connect.
 * offline_access scope is what yields a refresh_token.
 */
const TENANT    = 'common';
const AUTH_URL  = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const GRAPH     = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'openid email offline_access User.Read Calendars.Read';

export const PROVIDER = 'microsoft';

export function isConfigured() {
  return !!(process.env.MS_OAUTH_CLIENT_ID && process.env.MS_OAUTH_CLIENT_SECRET);
}

function config() {
  return {
    clientId:     process.env.MS_OAUTH_CLIENT_ID,
    clientSecret: process.env.MS_OAUTH_CLIENT_SECRET,
  };
}

export function buildAuthUrl(state, redirectUri) {
  const { clientId } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: SCOPES,
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
      redirect_uri: redirectUri, grant_type: 'authorization_code', scope: SCOPES,
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token exchange failed (${res.status})`);
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
      client_secret: clientSecret, grant_type: 'refresh_token', scope: SCOPES,
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token refresh failed (${res.status})`);
  const t = await res.json();
  return {
    accessToken: t.access_token,
    // MS may issue a rotated refresh token; surface it so the caller can persist it.
    refreshToken: t.refresh_token ?? null,
    expiresAt:   Math.floor(Date.now() / 1000) + (t.expires_in ?? 3600),
  };
}

export async function fetchAccountEmail(accessToken) {
  const res = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const j = await res.json();
  return j.mail || j.userPrincipalName || null;
}

export async function listCalendars(accessToken) {
  const res = await fetch(`${GRAPH}/me/calendars?$select=id,name,isDefaultCalendar`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Microsoft calendar list failed (${res.status})`);
  const j = await res.json();
  return (j.value ?? []).map(c => ({
    id: c.id,
    name: c.name || c.id,
    primary: !!c.isDefaultCalendar,
  }));
}

/** Fetch events in [timeMin, timeMax] (ISO strings) via calendarView and normalize. */
export async function listEvents(accessToken, calendarId, timeMin, timeMax) {
  const out = [];
  const params = new URLSearchParams({
    startDateTime: timeMin, endDateTime: timeMax, $top: '500',
    $select: 'subject,start,end,isAllDay,bodyPreview',
  });
  let url = `${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params}`;
  // Graph caps page size; follow @odata.nextLink until exhausted.
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
    });
    if (!res.ok) throw new Error(`Microsoft events fetch failed (${res.status})`);
    const j = await res.json();
    for (const e of j.value ?? []) {
      const allDay = !!e.isAllDay;
      // Graph returns naive datetimes (no zone suffix); with the Prefer header
      // above they're UTC, so strip fractional seconds and mark as Z.
      const toIso = (dt) => dt?.dateTime ? `${dt.dateTime.split('.')[0]}Z` : null;
      out.push({
        id: e.id,
        title: e.subject || '(no title)',
        start: allDay ? e.start?.dateTime?.slice(0, 10) : toIso(e.start),
        end:   allDay ? e.end?.dateTime?.slice(0, 10)   : toIso(e.end),
        allDay,
        notes: e.bodyPreview ?? null,
      });
    }
    url = j['@odata.nextLink'] ?? null;
  }
  return out;
}
