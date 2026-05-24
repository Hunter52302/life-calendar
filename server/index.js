import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// ── Database (imported for side-effect: connects + runs migrations) ──────────
import './db/index.js';

// ── Route modules ────────────────────────────────────────────────────────────
import authRoute            from './routes/auth.js';
import eventsRoute          from './routes/events.js';
import categoriesRoute      from './routes/categories.js';
import linkedCalendarsRoute from './routes/linkedCalendars.js';
import driveTimeRoute       from './routes/driveTime.js';
import geocodeGoogleRoute   from './routes/geocodeGoogle.js';
import geocodeNominatimRoute from './routes/geocodeNominatim.js';

// ── Auth middleware (for the /sync convenience endpoint) ─────────────────────
import { requireAuth } from './middleware/auth.js';
import { events, customCategories, categoryOverrides, deletedDefaults, linkedCalendars } from './db/queries.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// CORS
// In development Vite proxies /api/* so CORS is never triggered.
// In production set FRONTEND_URL=https://yourapp.com in the host's env vars.
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);

app.use(express.json({ limit: '10mb' })); // larger limit for bulk iCal imports

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth',            authRoute);
app.use('/api/events',          eventsRoute);
app.use('/api/categories',      categoriesRoute);
app.use('/api/linked-calendars', linkedCalendarsRoute);
app.use('/api/drive-time',      driveTimeRoute);
app.use('/api/geocode/google',  geocodeGoogleRoute);
app.use('/api/geocode/nominatim', geocodeNominatimRoute);

/**
 * GET /api/sync
 * Convenience endpoint: returns ALL user data in one request.
 * The frontend calls this once on startup instead of 4 separate fetches.
 */
app.get('/api/sync', requireAuth, (req, res) => {
  res.json({
    events:           events.getAll(req.userId),
    customCategories: customCategories.getAll(req.userId),
    categoryOverrides: categoryOverrides.getAll(req.userId),
    linkedCalendars:  linkedCalendars.getAll(req.userId),
    deletedDefaultIds: deletedDefaults.getAll(req.userId),
  });
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`PLS Calendar API  →  http://localhost:${PORT}`);
  console.log(`Google Maps key   →  ${process.env.GOOGLE_MAPS_API_KEY ? '✓ loaded' : '✗ MISSING'}`);
});
