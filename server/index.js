import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// â”€â”€ Route modules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import authRoute            from './routes/auth.js';
import authGoogleRoute      from './routes/authGoogle.js';
import eventsRoute          from './routes/events.js';
import categoriesRoute      from './routes/categories.js';
import linkedCalendarsRoute from './routes/linkedCalendars.js';
import habitsRoute          from './routes/habits.js';
import budgetsRoute         from './routes/budgets.js';
import integrationsRoute    from './routes/integrations.js';
import pushRoute            from './routes/push.js';
import profileRoute         from './routes/profile.js';
import categoryKeywordsRoute from './routes/categoryKeywords.js';
import llmSettingsRoute     from './routes/llmSettings.js';
import appearanceRoute      from './routes/appearance.js';
import adminRoute           from './routes/admin.js';
import icalFetchRoute       from './routes/icalFetch.js';
import feedRoute            from './routes/feed.js';
import oauthGoogleRoute     from './routes/oauthGoogle.js';
import oauthMicrosoftRoute  from './routes/oauthMicrosoft.js';
import calendarConnectionsRoute from './routes/calendarConnections.js';
import releasesRoute         from './routes/releases.js';
import travelTimeRoute       from './routes/travelTime.js';
import { initializeInfisical } from './lib/secrets.js';
import { startScheduler }   from './services/notificationService.js';
import { pocketbaseEvents } from './lib/pocketbaseEvents.js';
import { pocketbaseHabitCompletions, pocketbaseHabits } from './lib/pocketbaseHabits.js';
import { pocketbaseNotificationSchedules, pocketbaseUserIntegrations } from './lib/pocketbaseNotifications.js';
import { pbCategoryKeywords, pbCategoryOverrides, pbCustomCategories, pbDeletedDefaults, pbLinkedCalendars, pbTimeBudgets, pbUserLlmSettings, pbUserProfile, pbUserAppearance } from './lib/pocketbaseSupport.js';

// â”€â”€ Auth middleware (for the /sync convenience endpoint) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { requireAuth } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Behind one reverse proxy (nginx) in production: trust exactly the first hop so
// req.ip and express-rate-limit see the real client IP (used for login/register
// rate limiting and signup-IP clustering) without trusting a spoofable, fully
// client-controlled X-Forwarded-For chain.
app.set('trust proxy', 1);

// This server only ever returns JSON, never HTML â€” disable the CSP/COEP
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

// The desktop (Tauri) build loads the frontend from a fixed local origin, not
// from FRONTEND_URL. These are constant, app-controlled origins — allow them
// unconditionally so the desktop app can reach the API without per-deploy env
// changes. Windows/WebView2 uses http://tauri.localhost; macOS/Linux use tauri://localhost.
const tauriOrigins = ['tauri://localhost', 'http://tauri.localhost'];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin) || tauriOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);

app.use(express.json({ limit: '10mb' })); // larger limit for bulk iCal imports

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
// Mounted before /api/auth so the more specific Google login routes match first.
app.use('/api/auth/google',     authGoogleRoute);
app.use('/api/auth',            authRoute);
app.use('/api/events',          eventsRoute);
app.use('/api/categories',      categoriesRoute);
app.use('/api/linked-calendars', linkedCalendarsRoute);
app.use('/api/habits',          habitsRoute);
app.use('/api/budgets',         budgetsRoute);
app.use('/api/integrations',    integrationsRoute);
app.use('/api/push',            pushRoute);
app.use('/api/profile',         profileRoute);
app.use('/api/category-keywords', categoryKeywordsRoute);
app.use('/api/llm-settings',    llmSettingsRoute);
app.use('/api/appearance',      appearanceRoute);
app.use('/api/admin',           adminRoute);
app.use('/api/ical-fetch',      icalFetchRoute);
app.use('/api/feed',            feedRoute);
app.use('/api/oauth/google',    oauthGoogleRoute);
app.use('/api/oauth/microsoft', oauthMicrosoftRoute);
app.use('/api/calendar-connections', calendarConnectionsRoute);
// Public: relays GitHub releases for the (private) repo so desktop downloads work.
app.use('/api/releases',        releasesRoute);
app.use('/api/travel-time',     travelTimeRoute);

await initializeInfisical();

/**
 * GET /api/sync
 * Convenience endpoint: returns ALL user data in one request.
 * The frontend calls this once on startup instead of 4 separate fetches.
 */
app.get('/api/sync', requireAuth, async (req, res) => {
  // Opportunistically GC this user's expired tombstones before we read them, so
  // the sync payload (and the table) stay bounded over time.
  try { await pocketbaseEvents.purgeExpiredTombstones(req.userId); } catch { /* non-critical */ }
  const [
    syncEvents,
    syncCustomCategories,
    syncCategoryOverrides,
    syncLinkedCalendars,
    syncDeletedDefaultIds,
    syncBudgets,
    syncProfile,
    syncCategoryKeywords,
    syncLlmSettings,
    syncHabits,
    syncHabitCompletions,
    syncIntegrations,
    syncSchedules,
    syncAppearance,
  ] = await Promise.all([
    pocketbaseEvents.getAllForSync(req.userId),
    pbCustomCategories.getAll(req.userId),
    pbCategoryOverrides.getAll(req.userId),
    pbLinkedCalendars.getAll(req.userId),
    pbDeletedDefaults.getAll(req.userId),
    pbTimeBudgets.getAll(req.userId),
    pbUserProfile.get(req.userId),
    pbCategoryKeywords.getAll(req.userId),
    pbUserLlmSettings.get(req.userId),
    pocketbaseHabits.getAll(req.userId),
    pocketbaseHabitCompletions.getAll(req.userId),
    pocketbaseUserIntegrations.getAll(req.userId),
    pocketbaseNotificationSchedules.getAll(req.userId),
    pbUserAppearance.get(req.userId),
  ]);
  res.json({
    events:            syncEvents, // live + recent tombstones for client merge
    customCategories:  syncCustomCategories,
    categoryOverrides: syncCategoryOverrides,
    linkedCalendars:   syncLinkedCalendars,
    deletedDefaultIds: syncDeletedDefaultIds,
    habits:            syncHabits,
    habitCompletions:  syncHabitCompletions,
    budgets:           syncBudgets,
    integrations:      syncIntegrations,
    schedules:         syncSchedules,
    profile:           syncProfile,
    categoryKeywords:  syncCategoryKeywords,
    llmSettings:       syncLlmSettings,
    appearance:        syncAppearance,
  });
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`PLS Calendar API  ->  http://localhost:${PORT}`);
  console.log('Location handoffs -> user-triggered only');
  console.log(`VAPID push        ->  ${process.env.VAPID_PUBLIC_KEY ? 'configured' : 'not configured'}`);
  console.log(`Google Calendar   ->  ${process.env.GOOGLE_OAUTH_CLIENT_ID ? 'configured' : 'not configured'}`);
  console.log(`Microsoft Calendar->  ${process.env.MS_OAUTH_CLIENT_ID ? 'configured' : 'not configured'}`);
  console.log(`Drive-time buffer ->  ${process.env.ORS_API_KEY ? 'configured' : 'not configured'}`);
  startScheduler();
});


