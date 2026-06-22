/**
 * POST /api/ical-fetch
 *
 * Fetches an external ICS calendar URL on behalf of the browser (which is
 * blocked by CORS from doing it directly). The server is a dumb relay: it
 * returns the raw ICS text and never parses or stores it — parsing and
 * (when ZK is on) encryption happen client-side, preserving zero-trust.
 *
 * The hostname is resolved exactly once via dns.lookup, every resolved
 * address is checked against the private/loopback/link-local blocklist, and
 * the connection is pinned to that already-validated address (via the
 * `lookup` option) so nothing re-resolves DNS after the check — closing the
 * DNS-rebinding gap a plain fetch() would leave open. Redirects are followed
 * manually so each hop gets the same validation.
 *
 * Body:     { url: string }
 * Response: { ics: string }
 */
import { Router } from 'express';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const MAX_BYTES     = 10 * 1024 * 1024; // 10 MB
const TIMEOUT_MS    = 15_000;
const MAX_REDIRECTS = 5;

/** Basic SSRF guard — block obviously internal hostnames before doing any DNS work. */
function isForbiddenHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  return isForbiddenIp(h);
}

/** Block private/loopback/link-local/CGNAT IPv4 and IPv6 literals, however they arrived (typed or DNS-resolved). */
function isForbiddenIp(ip) {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/) ?? ip.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;  // unique local fc00::/7
  return false;
}

function lookupAll(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses);
    });
  });
}

/** Resolve hostname once and validate every address it returns. Returns the address to pin the connection to. */
async function resolveAndValidate(hostname) {
  let addresses;
  try {
    addresses = await lookupAll(hostname);
  } catch {
    const err = new Error('Could not resolve host.');
    err.userError = true;
    throw err;
  }
  if (addresses.length === 0 || addresses.some(a => isForbiddenIp(a.address))) {
    const err = new Error('This host is not allowed.');
    err.userError = true;
    throw err;
  }
  return addresses[0];
}

function requestOnce(targetUrl, resolvedAddr, { headers, signal }) {
  return new Promise((resolve, reject) => {
    const isHttps = targetUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const req = transport.request({
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: 'GET',
      headers,
      signal,
      // Pin to the address we already validated — no second DNS resolution at connect time.
      // Node's net module requests the array form when options.all is set (Happy Eyeballs).
      lookup: (_hostname, options, callback) => options?.all
        ? callback(null, [{ address: resolvedAddr.address, family: resolvedAddr.family }])
        : callback(null, resolvedAddr.address, resolvedAddr.family),
    }, resolve);
    req.on('error', reject);
    req.end();
  });
}

function readBody(response, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    response.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        response.destroy();
        const err = new Error('Calendar file is too large (max 10 MB).');
        err.tooLarge = true;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    response.on('error', reject);
  });
}

router.post('/', async (req, res) => {
  const { url } = req.body ?? {};
  if (!url?.trim()) return res.status(400).json({ error: 'url is required.' });

  let currentUrl;
  try {
    currentUrl = new URL(url.trim());
  } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }
  // Google/Apple publish webcal:// links — treat them as https
  if (currentUrl.protocol === 'webcal:') currentUrl.protocol = 'https:';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response;
    for (let redirectsLeft = MAX_REDIRECTS; ; redirectsLeft--) {
      if (!['http:', 'https:'].includes(currentUrl.protocol)) {
        return res.status(400).json({ error: 'Only http(s) and webcal URLs are supported.' });
      }
      if (isForbiddenHost(currentUrl.hostname)) {
        return res.status(400).json({ error: 'This host is not allowed.' });
      }

      let resolvedAddr;
      try {
        resolvedAddr = await resolveAndValidate(currentUrl.hostname);
      } catch (err) {
        if (err.userError) return res.status(400).json({ error: 'This host is not allowed.' });
        throw err;
      }

      response = await requestOnce(currentUrl, resolvedAddr, {
        headers: { 'User-Agent': 'PLS-Calendar/1.0', 'Accept': 'text/calendar, text/plain, */*' },
        signal: controller.signal,
      });

      if (![301, 302, 303, 307, 308].includes(response.statusCode)) break;
      response.resume(); // discard redirect body
      if (redirectsLeft <= 0) return res.status(502).json({ error: 'Too many redirects.' });
      const location = response.headers.location;
      if (!location) return res.status(502).json({ error: 'Redirect with no location.' });
      currentUrl = new URL(location, currentUrl);
    }
    clearTimeout(timer);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      response.resume();
      return res.status(502).json({ error: `Calendar server responded with ${response.statusCode}.` });
    }
    const length = Number(response.headers['content-length'] ?? 0);
    if (length > MAX_BYTES) {
      response.resume();
      return res.status(413).json({ error: 'Calendar file is too large (max 10 MB).' });
    }

    const text = await readBody(response, MAX_BYTES);
    if (!text.includes('BEGIN:VCALENDAR')) {
      return res.status(422).json({ error: 'The URL did not return an ICS calendar.' });
    }
    res.json({ ics: text });
  } catch (err) {
    clearTimeout(timer);
    if (err.tooLarge) return res.status(413).json({ error: err.message });
    const msg = err.name === 'AbortError' ? 'Calendar fetch timed out.' : 'Could not reach the calendar URL.';
    res.status(502).json({ error: msg, details: err.message });
  }
});

export default router;
