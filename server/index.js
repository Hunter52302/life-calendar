import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

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
import habitsRoute          from './routes/habits.js';
import budgetsRoute         from './routes/budgets.js';
import integrationsRoute    from './routes/integrations.js';
import pushRoute            from './routes/push.js';
import profileRoute         from './routes/profile.js';
import categoryKeywordsRoute from './routes/categoryKeywords.js';
import llmSettingsRoute     from './routes/llmSettings.js';
import adminRoute           from './routes/admin.js';
import icalFetchRoute       from './routes/icalFetch.js';
import feedRoute            from './routes/feed.js';
import oauthGoogleRoute     from './routes/oauthGoogle.js';
import oauthMicrosoftRoute  from './routes/oauthMicrosoft.js';
import calendarConnectionsRoute from './routes/calendarConnections.js';
import { initializeInfisical } from './lib/secrets.js';
import { startScheduler }   from './services/notificationService.js';

// ── Auth middleware (for the /sync convenience endpoint) ─────────────────────
import { requireAuth } from './middleware/auth.js';
import { events, customCategories, categoryOverrides, deletedDefaults, linkedCalendars, habits, habitCompletions, timeBudgets, userIntegrations, notificationSchedules, userProfile, categoryKeywords, userLlmSettings } from './db/queries.js';

const app = express();
const PORT = process.env.PORT || 3001;

// This server only ever returns JSON, never HTML — disable the CSP/COEP
// headers meant for HTML responses so they don't add noise to API clients.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

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
app.use('/api/habits',          habitsRoute);
app.use('/api/budgets',         budgetsRoute);
app.use('/api/integrations',    integrationsRoute);
app.use('/api/push',            pushRoute);
app.use('/api/profile',         profileRoute);
app.use('/api/category-keywords', categoryKeywordsRoute);
app.use('/api/llm-settings',    llmSettingsRoute);
app.use('/api/admin',           adminRoute);
app.use('/api/ical-fetch',      icalFetchRoute);
app.use('/api/feed',            feedRoute);
app.use('/api/oauth/google',    oauthGoogleRoute);
app.use('/api/oauth/microsoft', oauthMicrosoftRoute);
app.use('/api/calendar-connections', calendarConnectionsRoute);

await initializeInfisical();

/**
 * GET /api/sync
 * Convenience endpoint: returns ALL user data in one request.
 * The frontend calls this once on startup instead of 4 separate fetches.
 */
app.get('/api/sync', requireAuth, (req, res) => {
  res.json({
    events:            events.getAllForSync(req.userId), // incl. tombstones for client merge
    customCategories:  customCategories.getAll(req.userId),
    categoryOverrides: categoryOverrides.getAll(req.userId),
    linkedCalendars:   linkedCalendars.getAll(req.userId),
    deletedDefaultIds: deletedDefaults.getAll(req.userId),
    habits:            habits.getAll(req.userId),
    habitCompletions:  habitCompletions.getAll(req.userId),
    budgets:           timeBudgets.getAll(req.userId),
    integrations:      userIntegrations.getAll(req.userId),
    schedules:         notificationSchedules.getAll(req.userId),
    profile:           userProfile.get(req.userId),
    categoryKeywords:  categoryKeywords.getAll(req.userId),
    llmSettings:       userLlmSettings.get(req.userId),
  });
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`PLS Calendar API  →  http://localhost:${PORT}`);
  console.log(`Drive times       →  OSRM (open-source)${process.env.GOOGLE_MAPS_API_KEY ? ' + Google fallback' : ''}`);
  console.log(`VAPID push        →  ${process.env.VAPID_PUBLIC_KEY ? '✓ configured' : '✗ not set (push notifications disabled)'}`);
  console.log(`Google Calendar   →  ${process.env.GOOGLE_OAUTH_CLIENT_ID ? '✓ OAuth configured' : '✗ not configured'}`);
  console.log(`Microsoft Calendar→  ${process.env.MS_OAUTH_CLIENT_ID ? '✓ OAuth configured' : '✗ not configured'}`);
  startScheduler();
});
