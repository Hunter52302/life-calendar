/**
 * POST /api/ical-fetch
 *
 * Fetches an external ICS calendar URL on behalf of the browser (which is
 * blocked by CORS from doing it directly). The server is a dumb relay: it
 * returns the raw ICS text and never parses or stores it — parsing and
 * (when ZK is on) encryption happen client-side, preserving zero-trust.
 *
 * Body:     { url: string }
 * Response: { ics: string }
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const MAX_BYTES  = 10 * 1024 * 1024; // 10 MB
const TIMEOUT_MS = 15_000;

/** Basic SSRF guard — block obviously internal targets. */
function isForbiddenHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  // Literal private/loopback/link-local IPv4 ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

router.post('/', async (req, res) => {
  const { url } = req.body ?? {};
  if (!url?.trim()) return res.status(400).json({ error: 'url is required.' });

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }
  // Google/Apple publish webcal:// links — treat them as https
  if (parsed.protocol === 'webcal:') parsed.protocol = 'https:';
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only http(s) and webcal URLs are supported.' });
  }
  if (isForbiddenHost(parsed.hostname)) {
    return res.status(400).json({ error: 'This host is not allowed.' });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'PLS-Calendar/1.0', 'Accept': 'text/calendar, text/plain, */*' },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return res.status(502).json({ error: `Calendar server responded with ${response.status}.` });
    }
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) {
      return res.status(413).json({ error: 'Calendar file is too large (max 10 MB).' });
    }
    const text = await response.text();
    if (text.length > MAX_BYTES) {
      return res.status(413).json({ error: 'Calendar file is too large (max 10 MB).' });
    }
    if (!text.includes('BEGIN:VCALENDAR')) {
      return res.status(422).json({ error: 'The URL did not return an ICS calendar.' });
    }
    res.json({ ics: text });
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Calendar fetch timed out.' : 'Could not reach the calendar URL.';
    res.status(502).json({ error: msg, details: err.message });
  }
});

export default router;
