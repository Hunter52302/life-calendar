/**
 * Canonical base URLs for the OAuth flow. The redirect URI MUST be byte-for-byte
 * identical between /connect and /callback (providers reject mismatches), so both
 * derive it from here.
 */
export function callbackBaseUrl() {
  return (process.env.OAUTH_CALLBACK_BASE_URL || `http://localhost:${process.env.PORT || 3001}`)
    .replace(/\/+$/, '');
}

export function redirectUriFor(provider) {
  return `${callbackBaseUrl()}/api/oauth/${provider}/callback`;
}

/**
 * Where to send the browser after the callback. Only ever the server-configured
 * frontend origin (first entry of FRONTEND_URL) — never a value from the request,
 * so this can't become an open redirect.
 */
export function frontendBaseUrl() {
  const first = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
  return first.replace(/\/+$/, '');
}
