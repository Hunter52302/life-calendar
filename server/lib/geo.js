/**
 * Open-source geo helpers — no API keys, no usage fees.
 *  - Geocoding: OpenStreetMap Nominatim (1 req/sec fair-use policy)
 *  - Routing:   OSRM public demo server (router.project-osrm.org)
 */

const USER_AGENT = 'PLS-Calendar/1.0 (contact@example.com)';

// Nominatim policy: never exceed 1 request per second across the whole app.
let lastNominatimCall = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1100;

async function throttleNominatim() {
  const gap = Date.now() - lastNominatimCall;
  if (gap < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, NOMINATIM_MIN_INTERVAL_MS - gap));
  }
  lastNominatimCall = Date.now();
}

/**
 * Resolve an address (or "lat,lng" string) to coordinates.
 * Returns { lat, lng, formatted } or null when no match is found.
 * Throws on network failure.
 */
export async function geocodeAddress(address) {
  const trimmed = address.trim();

  // "lat,lng" passthrough — no geocoding needed
  const m = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), formatted: trimmed };

  await throttleNominatim();
  const params = new URLSearchParams({ q: trimmed, format: 'json', limit: '1' });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
  });
  const data = await response.json();
  if (!data?.length) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    formatted: data[0].display_name,
  };
}

/**
 * Compute a driving route between two coordinates via OSRM.
 * Returns { durationSeconds, distanceMeters }.
 * Throws when OSRM cannot find a route or is unreachable.
 */
export async function osrmRoute(from, to) {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`,
    { headers: { 'User-Agent': USER_AGENT } }
  );
  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(data.message ?? `OSRM error: ${data.code}`);
  }
  return {
    durationSeconds: data.routes[0].duration,
    distanceMeters:  data.routes[0].distance,
  };
}
