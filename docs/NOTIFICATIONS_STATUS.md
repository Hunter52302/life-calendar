# Push Notifications & Webhooks — status and remaining work

**Status:** Server delivery is essentially complete; the gaps are client wiring
(mobile), operator configuration (VAPID/SMTP/Twilio), and a few robustness
fixes. This is a checklist of what's left to have reminders working end‑to‑end
on **web, desktop, and mobile**, plus **webhooks** (Discord / Slack / generic).

## What already works

- **Scheduler** — `server/services/notificationService.js` runs every 60 s
  (`startScheduler()` is called from `server/index.js`). It evaluates each
  user's active notification *schedules* (`event_reminder`, `habit_reminder`,
  `daily_summary`, plus streak milestones fired inline from the habits route)
  in the user's timezone and dispatches to every enabled integration. A
  per‑day de‑dupe log (`pocketbaseNotificationLog.wasFiredToday`) prevents
  double‑sends.
- **Channels implemented** — `web_push`, `expo_push`, `discord_webhook`,
  `slack_webhook`, `generic_webhook`, `email` (SMTP/nodemailer), `sms`
  (Twilio REST). Each has a **Test fire** endpoint (`POST /integrations/:id/test`).
- **Web push service worker** — `public/sw-push.js` handles `push` and
  `notificationclick`; it is merged into the Workbox SW via
  `importScripts('/sw-push.js')` (see `vite.config.js`). The SW is registered on
  web through `WebUpdateGate` (`virtual:pwa-register/react`).
- **Web subscribe flow** — `useIntegrations.subscribePush()` fetches the VAPID
  public key, subscribes via `pushManager`, and POSTs to `/push/subscribe`,
  which also auto‑creates a `web_push` integration row.
- **ZK‑safe payloads** — the server only knows *timing* metadata. Event/habit
  titles are only included when the user set an `integration_hint` **and**
  turned on "include hints" for that integration; otherwise copy is generic.

## Remaining work

### 1. Operator configuration (no code — required before anything sends)
These are all commented out in `.env.example` and must be set in the deployment
env (Coolify stack):

- [ ] **VAPID keys** (required for web push): generate with `npm run vapid:keys`,
      then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
      (`mailto:` or `https:` contact). Without these, `/push/vapid-public-key`
      returns 503 and `dispatchWebPush` is a no‑op.
- [ ] **SMTP** (required for email reminders): `SMTP_HOST`, `SMTP_PORT`,
      `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Unset → email integrations are
      silently skipped.
- [ ] **Twilio** (required for SMS): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
      `TWILIO_FROM_NUMBER`. Unset → SMS integrations are silently skipped.

### 2. Web / PWA push
- [ ] **Dev caveat:** the service worker is not served under `npm run dev`
      (VitePWA `devOptions.enabled` is off), so `subscribePush()` fails there.
      Test web push against a **production build** (`npm run build` + `preview`)
      or enable `devOptions`.
- [ ] **Re‑subscribe on expiry:** browser push subscriptions can be rotated by
      the browser. There is no `pushsubscriptionchange` handler in
      `sw-push.js` and no periodic re‑subscribe, so a rotated subscription goes
      silently dead. Add a `pushsubscriptionchange` listener that re‑subscribes
      and re‑POSTs to `/push/subscribe`.
- [ ] **Prune dead endpoints:** `dispatchWebPush` logs 404/410 failures but does
      not delete the stale subscription, so the log fills with permanent
      failures. Delete the subscription on 404/410.

### 3. Desktop (Tauri)
- Native reminders work via `@tauri-apps/plugin-notification`
  (`src/hooks/useDesktopTray.js`), computed **client‑side while the app is
  running** — this is independent of the server scheduler and needs no VAPID.
- [ ] **Background delivery:** because reminders are computed in‑app, nothing
      fires while the desktop app is fully closed. Either (a) document this as
      expected, or (b) have the desktop build also register for **web push** so
      the OS wakes it. Decide which; today it is (a) by default.
- [ ] Confirm the notification **permission prompt** is requested on first run
      (the code requests it, but verify on a packaged build per‑OS).

### 4. Mobile (Expo / React Native) — **biggest gap**
- The client half exists but is **never called**: `registerForPushNotificationsAsync()`
  (`mobile/src/lib/push.js`) and `api.expoToken()` (`mobile/src/lib/api.js`)
  are defined, but nothing invokes them, so no Expo token is ever sent to
  `/push/expo-token`. **Wire `registerForPushNotificationsAsync()` into the
  post‑login startup** and POST the returned token via `api.expoToken()`.
- [ ] **Build requirements:** remote push needs a **dev/standalone build**, not
      Expo Go (SDK 53+). EAS `projectId` is already set in `mobile/app.json`.
- [ ] **Platform credentials:** iOS needs an **APNs key** and Android an **FCM**
      config registered with EAS before production push works.
- [ ] **CI/OTA:** EAS builds/OTA require the `EXPO_TOKEN` GitHub secret (a
      missing secret currently fails the mobile OTA step).
- [ ] **Token refresh/unsubscribe:** re‑register on token change and remove the
      `expo_push` integration on sign‑out.

### 5. Webhooks (Discord / Slack / generic)
- Fully implemented and test‑fireable. Hardening left:
- [ ] **Delivery retry/backoff:** a failed webhook is logged as `failed` once
      and never retried (`dispatchWebhook` throws, the tick moves on). Add a
      small retry with backoff, or a failed‑delivery requeue.
- [ ] **Generic webhook signing:** the `generic_webhook` payload is unsigned.
      Add an optional per‑integration secret and an HMAC signature header so
      receivers can verify authenticity.
- [ ] **SSRF guard:** `endpoint_url` is user‑supplied and POSTed from the
      server. Consider blocking internal/loopback/link‑local targets for the
      generic type.

### 6. Scheduler robustness (affects every channel)
- [ ] **Exact‑minute matching is fragile.** `event_reminder` only fires when the
      current minute equals the reminder minute (`nowMinute === reminderMinute`).
      If a 60 s tick is delayed or the process restarts across that minute, the
      reminder is **missed with no catch‑up**. Match a small trailing window
      (e.g. "due in the last N minutes and not yet logged") instead of exact
      equality, leaning on the per‑day de‑dupe log to avoid repeats.
- [ ] **Schedule‑creation UX:** reminders only fire if the user has a *schedule*
      (not just an integration). Verify the Settings → Notifications UI makes it
      obvious that a schedule is required, and that enabling browser push also
      seeds a default `event_reminder` schedule.

## Quick "is it working?" checklist
1. Set VAPID (and SMTP/Twilio if used) in the deployment env; restart the stack.
2. Web: production build → Settings → enable Browser Push → **Test** an
   integration → confirm the OS notification appears.
3. Create an `event_reminder` schedule; create a near‑future plan event; confirm
   it fires within ~1 minute of the lead time.
4. Mobile: after wiring token registration, sign in on a dev build → confirm a
   row appears in `push_subscriptions`/`expo_push` and **Test** delivers.
5. Webhooks: add a Discord/Slack URL → **Test** → confirm the message posts.
