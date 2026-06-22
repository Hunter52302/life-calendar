/**
 * POST /api/drive-time
 *
 * Drive time between two addresses. Primary provider is the open-source
 * stack (Nominatim geocoding + OSRM routing) — free, no API key, no usage
 * fees. If OSRM fails and GOOGLE_MAPS_API_KEY is set, falls back to the
 * Google Maps Directions API (which also adds real-time traffic data).
 *
 * Request body
 * ------------
 * {
 *   origin:        string,           // address or "lat,lng"
 *   destination:   string,           // address or "lat,lng"
 *   departureTime: "now" | number,   // optional — Google fallback only
 * }
 *
 * Success response (200)
 * ----------------------
 * {
 *   durationMinutes:          number,
 *   durationText:             string,        // "23 min"
 *   durationInTrafficMinutes: number | null, // Google fallback only
 *   durationInTrafficText:    string | null,
 *   distanceMiles:            number,
 *   distanceText:             string,        // "12.4 mi"
 *   hasTrafficData:           boolean,
 *   provider:                 'osrm' | 'google',
 * }
 *
 * Error response (4xx / 5xx)
 * --------------------------
 * { error: string, code?: string }
 */

import { Router } from 'express';
import { geocodeAddress, osrmRoute } from '../lib/geo.js';
import { getSecret } from '../lib/secrets.js';

const router = Router();

const GOOGLE_STATUS_MSG = {
  NOT_FOUND:              'One or both addresses could not be found.',
  ZERO_RESULTS:           'No driving route found between these locations.',
  MAX_WAYPOINTS_EXCEEDED: 'Too many waypoints in the request.',
  INVALID_REQUEST:        'The request was malformed.',
  REQUEST_DENIED:         'API key was rejected — check your key and that the Directions API is enabled.',
  OVER_DAILY_LIMIT:       'API daily quota exceeded.',
  OVER_QUERY_LIMIT:       'API rate limit hit — wait a moment and try again.',
  UNKNOWN_ERROR:          'An unknown error occurred on Google\'s servers.',
};

function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

async function osrmDriveTime(origin, destination) {
  const [from, to] = await Promise.all([geocodeAddress(origin), geocodeAddress(destination)]);
  if (!from) throw Object.assign(new Error('Origin address could not be found.'), { userError: true });
  if (!to)   throw Object.assign(new Error('Destination address could not be found.'), { userError: true });

  const route = await osrmRoute(from, to);
  const durationMinutes = Math.ceil(route.durationSeconds / 60);
  const distanceMiles   = Math.round((route.distanceMeters / 1609.344) * 10) / 10;

  return {
    durationMinutes,
    durationText:             fmtDuration(durationMinutes),
    durationInTrafficMinutes: null,
    durationInTrafficText:    null,
    distanceMiles,
    distanceText:             `${distanceMiles} mi`,
    hasTrafficData:           false,
    provider:                 'osrm',
  };
}

async function googleDriveTime(origin, destination, departureTime, apiKey) {
  const params = new URLSearchParams({
    origin, destination, mode: 'driving', units: 'imperial', key: apiKey,
  });
  if (departureTime) params.set('departure_time', String(departureTime));

  const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
  const data = await response.json();
  if (data.status !== 'OK') {
    throw Object.assign(
      new Error(GOOGLE_STATUS_MSG[data.status] ?? `Google Maps error: ${data.status}`),
      { userError: true, code: data.status }
    );
  }

  const leg = data.routes[0].legs[0];
  const durationMinutes = Math.ceil(leg.duration.value / 60);
  const distanceMiles   = Math.round((leg.distance.value / 1609.344) * 10) / 10;
  const inTraffic = leg.duration_in_traffic ?? null;

  return {
    durationMinutes,
    durationText:             leg.duration.text,
    durationInTrafficMinutes: inTraffic ? Math.ceil(inTraffic.value / 60) : null,
    durationInTrafficText:    inTraffic?.text ?? null,
    distanceMiles,
    distanceText:             leg.distance.text,
    hasTrafficData:           !!inTraffic,
    provider:                 'google',
  };
}

router.post('/', async (req, res) => {
  const { origin, destination, departureTime } = req.body ?? {};
  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin and destination are required.' });
  }

  // ── Primary: open-source OSRM ─────────────────────────────────────────────
  let osrmError;
  try {
    return res.status(200).json(await osrmDriveTime(origin, destination));
  } catch (err) {
    osrmError = err;
  }

  // ── Fallback: Google (only when a key is configured) ──────────────────────
  // Resolves from Infisical → process.env
  const apiKey = await getSecret('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    if (osrmError.userError) {
      return res.status(400).json({ error: osrmError.message });
    }
    return res.status(502).json({
      error: 'Could not calculate the route (routing service unreachable).',
      details: osrmError?.message,
    });
  }
  try {
    return res.status(200).json(await googleDriveTime(origin, destination, departureTime, apiKey));
  } catch (err) {
    const status = err.userError ? 400 : 502;
    return res.status(status).json({ error: err.message, code: err.code });
  }
});

export default router;
