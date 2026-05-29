/**
 * POST /api/geocode/google
 *
 * Validates and standardizes an address using the Google Geocoding API.
 * Uses the same GOOGLE_MAPS_API_KEY as the drive-time route.
 *
 * Request body
 * ------------
 * { address: string }
 *
 * Success response (200)
 * ----------------------
 * {
 *   valid:     true,
 *   formatted: string,   // Google's cleaned version e.g. "123 Main St, Chicago, IL 60601, USA"
 *   lat:       number,
 *   lng:       number,
 *   placeId:   string,   // stable Google place identifier — store this to skip re-geocoding
 *   provider:  "google",
 * }
 *
 * Not-found response (200 — not an error, just no match)
 * -------------------------------------------------------
 * { valid: false, provider: "google", reason: string }
 *
 * Error response (4xx / 5xx)
 * --------------------------
 * { error: string, code?: string }
 *
 * NOTE: Enable the "Geocoding API" in your Google Cloud project alongside
 *       the Directions API — same key, just needs the extra API enabled.
 */

import { Router } from 'express';
import { getSecret } from '../lib/secrets.js';

const router = Router();

const GOOGLE_STATUS_MSG = {
  ZERO_RESULTS:    'Address not found. Try adding more detail (city, state, zip).',
  INVALID_REQUEST: 'The address string was empty or malformed.',
  REQUEST_DENIED:  'API key rejected — make sure the Geocoding API is enabled in your Google Cloud project.',
  OVER_DAILY_LIMIT:  'API daily quota exceeded.',
  OVER_QUERY_LIMIT:  'API rate limit hit — wait a moment and try again.',
  UNKNOWN_ERROR:     'An unknown error occurred on Google\'s servers.',
};

router.post('/', async (req, res) => {
  // ── Guard: API key (resolves from Infisical → process.env) ───────────────
  const apiKey = await getSecret('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return res.status(500).json({
      error: 'GOOGLE_MAPS_API_KEY is not set. Add it via the No Touchy admin panel or your .env file.',
    });
  }

  // ── Guard: address ────────────────────────────────────────────────────────
  const { address } = req.body ?? {};
  if (!address?.trim()) {
    return res.status(400).json({ error: 'address is required.' });
  }

  // ── Call Google Geocoding API ─────────────────────────────────────────────
  const params = new URLSearchParams({ address: address.trim(), key: apiKey });

  let data;
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`
    );
    data = await response.json();
  } catch (err) {
    return res.status(502).json({
      error: 'Could not reach Google Geocoding API.',
      details: err.message,
    });
  }

  // ── No results — valid response, just no match ────────────────────────────
  if (data.status === 'ZERO_RESULTS') {
    return res.status(200).json({
      valid:    false,
      provider: 'google',
      reason:   GOOGLE_STATUS_MSG.ZERO_RESULTS,
    });
  }

  // ── Other Google-level errors ─────────────────────────────────────────────
  if (data.status !== 'OK') {
    return res.status(400).json({
      error: GOOGLE_STATUS_MSG[data.status] ?? `Google Geocoding error: ${data.status}`,
      code:  data.status,
    });
  }

  // ── Return the first (best) result ────────────────────────────────────────
  const result   = data.results[0];
  const location = result.geometry.location;

  return res.status(200).json({
    valid:     true,
    formatted: result.formatted_address,
    lat:       location.lat,
    lng:       location.lng,
    placeId:   result.place_id,   // store this — lets you skip re-geocoding for drive-time later
    provider:  'google',
  });
});

export default router;
