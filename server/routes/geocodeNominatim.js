/**
 * POST /api/geocode/nominatim
 *
 * Validates and standardizes an address using OpenStreetMap's Nominatim API.
 * No API key required — completely free.
 *
 * Request body
 * ------------
 * { address: string }
 *
 * Success response (200)
 * ----------------------
 * {
 *   valid:     true,
 *   formatted: string,   // Nominatim's display name e.g. "123 Main St, Chicago, Cook County, IL 60601, US"
 *   lat:       number,
 *   lng:       number,
 *   placeId:   null,     // always null — Nominatim has osm_id but no stable place ID
 *   provider:  "nominatim",
 * }
 *
 * Not-found response (200 — not an error, just no match)
 * -------------------------------------------------------
 * { valid: false, provider: "nominatim", reason: string }
 *
 * Error response (5xx)
 * --------------------
 * { error: string }
 *
 * Usage notes
 * -----------
 * - Nominatim's terms require a descriptive User-Agent and limit requests to
 *   1 per second. For a personal calendar used by one person this is fine.
 *   Do NOT use this endpoint for bulk/batch geocoding.
 * - Accuracy is slightly lower than Google's, especially for partial addresses
 *   or addresses outside major cities.
 * - See: https://operations.osmfoundation.org/policies/nominatim/
 */

import { Router } from 'express';

const router = Router();

// Simple in-memory throttle — ensures we never exceed 1 req/sec to Nominatim.
let lastNominatimCall = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1100; // slightly over 1 s to be safe

router.post('/', async (req, res) => {
  // ── Guard: address ────────────────────────────────────────────────────────
  const { address } = req.body ?? {};
  if (!address?.trim()) {
    return res.status(400).json({ error: 'address is required.' });
  }

  // ── Throttle ──────────────────────────────────────────────────────────────
  const now = Date.now();
  const gap = now - lastNominatimCall;
  if (gap < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, NOMINATIM_MIN_INTERVAL_MS - gap));
  }
  lastNominatimCall = Date.now();

  // ── Call Nominatim ────────────────────────────────────────────────────────
  const params = new URLSearchParams({
    q:              address.trim(),
    format:         'json',
    limit:          '1',
    addressdetails: '1',
  });

  let data;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          // Nominatim policy: must identify your app and provide contact info.
          // Update this to your own app name / contact before going to production.
          'User-Agent': 'PLS-Calendar/1.0 (contact@example.com)',
          'Accept-Language': 'en',
        },
      }
    );
    data = await response.json();
  } catch (err) {
    return res.status(502).json({
      error: 'Could not reach Nominatim (OpenStreetMap).',
      details: err.message,
    });
  }

  // ── No results ────────────────────────────────────────────────────────────
  if (!data || data.length === 0) {
    return res.status(200).json({
      valid:    false,
      provider: 'nominatim',
      reason:   'Address not found. Try adding more detail (city, state, zip).',
    });
  }

  // ── Return the best match ─────────────────────────────────────────────────
  const result = data[0];

  return res.status(200).json({
    valid:     true,
    formatted: result.display_name,
    lat:       parseFloat(result.lat),
    lng:       parseFloat(result.lon),
    placeId:   null,   // no stable ID — use lat/lng for drive-time calculations
    provider:  'nominatim',
  });
});

export default router;
