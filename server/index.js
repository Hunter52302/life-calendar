import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import driveTimeRoute        from './routes/driveTime.js';
import geocodeGoogleRoute    from './routes/geocodeGoogle.js';
import geocodeNominatimRoute from './routes/geocodeNominatim.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// CORS
// In development Vite proxies /api/* so CORS is never triggered.
// In production set FRONTEND_URL=https://yourapp.com in the host's env vars.
// Multiple origins: comma-separate them  e.g. "https://a.com,https://b.com"
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin requests (no Origin header) and listed origins
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);

app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/drive-time',         driveTimeRoute);

// Address validation — two providers with the same response shape.
// The frontend can call either; swap freely without changing the UI code.
//   POST /api/geocode/google    — requires GOOGLE_MAPS_API_KEY (same key as drive-time)
//   POST /api/geocode/nominatim — no API key needed, free, 1 req/sec limit
app.use('/api/geocode/google',    geocodeGoogleRoute);
app.use('/api/geocode/nominatim', geocodeNominatimRoute);

// Health check — useful for hosting platforms that ping to check liveness
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`PLS Calendar API  →  http://localhost:${PORT}`);
  console.log(`Google Maps key   →  ${process.env.GOOGLE_MAPS_API_KEY ? '✓ loaded' : '✗ MISSING (set GOOGLE_MAPS_API_KEY in .env)'}`);
});
