/**
 * Travel-time estimation — turns two addresses into a driving duration so the
 * app can set a "drive-time buffer" automatically instead of the user typing a
 * number of minutes.
 *
 * WHY A SERVER PROXY (and not a direct browser call):
 *   1. The routing provider's API key stays SERVER-SIDE, never shipped in the
 *      client bundle where it could be scraped and abused.
 *   2. This app is zero-knowledge: addresses are encrypted client-side before
 *      they ever reach storage. This endpoint is the one place plaintext leaves
 *      the device, and only for a single lookup — we never persist it. The
 *      in-memory caches below hold coordinates/durations for the process
 *      lifetime only (to respect provider rate limits) and are wiped on restart.
 *
 * PROVIDER STACK (free tiers, no billing account required):
 *   geocoding → OpenStreetMap Nominatim   (address → lat/lon)
 *   routing   → OpenRouteService          (lat/lon pair → driving seconds)
 *
 * POST /api/travel-time  { origin, destination, mode? }
 *   mode ∈ { car (default), walk, bike } → chooses the ORS routing profile.
 *   → 200 { minutes, meters, mode, provider }
 *   → 400 missing origin/destination
 *   → 422 an address could not be geocoded / no route found
 *   → 502 upstream provider error
 *   → 503 ORS_API_KEY not configured on the server
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSecret } from '../lib/secrets.js';

const router = Router();

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const ORS_BASE      = 'https://api.openrouteservice.org/v2/directions';
const TIMEOUT_MS    = 12_000;

// Travel modes the UI offers → OpenRouteService routing profiles. Transit is
// intentionally absent: ORS has no free public-transit routing.
const MODE_PROFILES = {
  car:  'driving-car',
  walk: 'foot-walking',
  bike: 'cycling-regular',
};

// Free-flow drive time between two fixed points barely changes, so cache
// aggressively to stay well within free tiers (Nominatim ~1 req/s, ORS
// 2000/day). Keyed by lowercased address / coordinate pair; values are
// ephemeral and never written to disk.
const GEOCODE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ROUTE_TTL_MS   = 7  * 24 * 60 * 60 * 1000; // 7 days
const geocodeCache = new Map();
const routeCache   = new Map();

function cacheGet(map, key, ttl) {
  const hit = map.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttl) { map.delete(key); return undefined; }
  return hit.value;
}
function cacheSet(map, key, value) { map.set(key, { value, at: Date.now() }); }

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Address string → { lat, lon } | null (null = provider found no match). */
async function geocode(address) {
  const key = address.trim().toLowerCase();
  const cached = cacheGet(geocodeCache, key, GEOCODE_TTL_MS);
  if (cached !== undefined) return cached;

  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetchWithTimeout(url, {
    // Nominatim's usage policy requires an identifying User-Agent.
    headers: { 'User-Agent': 'LifeCalendar/1.0 (travel-time buffer)' },
  });
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const data = await res.json();
  const first = Array.isArray(data) ? data[0] : null;
  const result = first ? { lat: Number(first.lat), lon: Number(first.lon) } : null;
  cacheSet(geocodeCache, key, result);
  return result;
}

/** Origin/dest coords → { seconds, meters } | null (null = no route). */
async function driveRoute(apiKey, origin, dest, profile) {
  const key = `${profile}|${origin.lat},${origin.lon}|${dest.lat},${dest.lon}`;
  const cached = cacheGet(routeCache, key, ROUTE_TTL_MS);
  if (cached !== undefined) return cached;

  // ORS expects coordinates as [lon, lat].
  const res = await fetchWithTimeout(`${ORS_BASE}/${profile}`, {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: [[origin.lon, origin.lat], [dest.lon, dest.lat]] }),
  });
  if (!res.ok) throw new Error(`route ${res.status}`);
  const data = await res.json();
  const summary = data?.routes?.[0]?.summary;
  const result = summary && typeof summary.duration === 'number'
    ? { seconds: summary.duration, meters: summary.distance ?? null }
    : null;
  cacheSet(routeCache, key, result);
  return result;
}

router.post('/', requireAuth, async (req, res) => {
  const apiKey = await getSecret('ORS_API_KEY');
  if (!apiKey) {
    return res.status(503).json({ error: 'Travel-time estimation is not configured on the server.' });
  }

  const origin      = String(req.body?.origin ?? '').trim();
  const destination = String(req.body?.destination ?? '').trim();
  const mode        = String(req.body?.mode ?? 'car').toLowerCase();
  const profile     = MODE_PROFILES[mode] ?? MODE_PROFILES.car;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin and destination are required.' });
  }

  try {
    const [from, to] = await Promise.all([geocode(origin), geocode(destination)]);
    if (!from) return res.status(422).json({ error: 'Could not find the starting address.' });
    if (!to)   return res.status(422).json({ error: 'Could not find the destination address.' });

    const route = await driveRoute(apiKey, from, to, profile);
    if (!route) return res.status(422).json({ error: 'No route found between those addresses.' });

    res.json({
      minutes: Math.round(route.seconds / 60),
      meters: route.meters,
      mode: MODE_PROFILES[mode] ? mode : 'car',
      provider: 'openrouteservice',
    });
  } catch (err) {
    // Never log the addresses themselves — only the failure reason.
    console.warn('[travel-time] lookup failed:', err.message);
    res.status(502).json({ error: 'Travel-time lookup failed. Please try again.' });
  }
});

export default router;
