/**
 * POST /api/drive-time
 *
 * Proxy to Google Maps Directions API. The API key stays on the server and
 * is never sent to the browser.
 *
 * Request body
 * ------------
 * {
 *   origin:        string,           // address or "lat,lng"
 *   destination:   string,           // address or "lat,lng"
 *   departureTime: "now" | number,   // optional — enables real-time traffic
 * }
 *
 * Success response (200)
 * ----------------------
 * {
 *   durationMinutes:          number,        // always present
 *   durationText:             string,        // "23 mins"
 *   durationInTrafficMinutes: number | null, // present only with traffic data
 *   durationInTrafficText:    string | null,
 *   distanceMiles:            number,
 *   distanceText:             string,        // "12.4 mi"
 *   hasTrafficData:           boolean,
 * }
 *
 * Error response (4xx / 5xx)
 * --------------------------
 * { error: string, code?: string }
 */

import { Router } from 'express';

const router = Router();

// Human-readable messages for every status Google can return
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

router.post('/', async (req, res) => {
  // ── Guard: API key ────────────────────────────────────────────────────────
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GOOGLE_MAPS_API_KEY is not set. Add it to your .env file.',
    });
  }

  // ── Guard: required fields ────────────────────────────────────────────────
  const { origin, destination, departureTime } = req.body ?? {};
  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin and destination are required.' });
  }

  // ── Build Google Maps request ─────────────────────────────────────────────
  const params = new URLSearchParams({
    origin,
    destination,
    mode:  'driving',
    units: 'imperial',
    key:   apiKey,
  });

  if (departureTime) {
    // "now" triggers real-time traffic; a Unix timestamp locks to a future time
    params.set('departure_time', String(departureTime));
  }

  // ── Call Google ───────────────────────────────────────────────────────────
  let data;
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params}`
    );
    data = await response.json();
  } catch (err) {
    return res.status(502).json({
      error: 'Could not reach Google Maps API.',
      details: err.message,
    });
  }

  // ── Handle Google-level errors (status in body, not HTTP code) ────────────
  if (data.status !== 'OK') {
    return res.status(400).json({
      error: GOOGLE_STATUS_MSG[data.status] ?? `Google Maps error: ${data.status}`,
      code:  data.status,
    });
  }

  // ── Extract the data we actually need ─────────────────────────────────────
  const leg = data.routes[0].legs[0];

  const durationMinutes = Math.ceil(leg.duration.value / 60);
  const distanceMiles   = Math.round((leg.distance.value / 1609.344) * 10) / 10;

  // Traffic duration is only present when departure_time was sent AND
  // the Google Maps Platform account has traffic data enabled
  const inTraffic = leg.duration_in_traffic ?? null;

  return res.status(200).json({
    durationMinutes,
    durationText:             leg.duration.text,
    durationInTrafficMinutes: inTraffic ? Math.ceil(inTraffic.value / 60) : null,
    durationInTrafficText:    inTraffic?.text ?? null,
    distanceMiles,
    distanceText:             leg.distance.text,
    hasTrafficData:           !!inTraffic,
  });
});

export default router;
