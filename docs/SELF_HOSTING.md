# Self-hosting PLS Calendar

PLS Calendar can run entirely on infrastructure you control. This page breaks
down the options, from "no server at all" to a full self-hosted sync backend, so
you can pick the level that matches what you want.

## The short version

There are three tiers, in increasing order of effort:

| Tier | You run | You get | You give up |
|------|---------|---------|-------------|
| **1. No account (local only)** | Nothing | The full app on one device, no setup | Sync, backup key, connected calendars, push |
| **2. Static frontend only** | A static file host | The app served from your own domain, still local-only per device | Same as tier 1 (no backend = no accounts/sync) |
| **3. Full self-hosted stack** | Frontend + Express API + PocketBase | Accounts, end-to-end encrypted sync across devices, calendar OAuth, push | Nothing — full feature set, on your hardware |

Most people who "want to self-host" mean **tier 3**. Tiers 1 and 2 are listed so
it's clear you can stop early if all you want is the app on your own domain.

---

## Tier 1 — No account, local only

Nothing to host. Open the app (web, desktop, or mobile), pick **"No account"** on
the first-run screen, and everything is stored in that device's local storage.
This is the account-free mode; it never talks to a backend.

- **Data location:** the browser/app storage on that one device.
- **Backup:** use the app's ICS/JSON export to make your own backups.
- **Caveat:** clearing site data or losing the device loses the calendar. There
  is no recovery key because there is no server holding an encrypted copy.

## Tier 2 — Host the frontend only

The frontend is a static single-page app. You can serve the build output from any
static host (Nginx, Caddy, Netlify, GitHub Pages, an S3 bucket, etc.).

- Build with `npm ci && npm run build` → serve the `dist/` folder.
- A ready-made `frontend.Dockerfile` + `deploy/frontend.nginx.conf` are included.
- With **no** backend configured (`VITE_API_URL` unset / unreachable), the app
  still works — it simply behaves as tier 1 for every visitor (local-only,
  no accounts). This is the "run it on my own domain but I don't need sync" option.

## Tier 3 — Full self-hosted stack (accounts + sync)

This is the complete backend. Architecture:

```
browser ──▶ reverse proxy ──▶ Express API (:3001) ──▶ PocketBase (:8090) ── pb_data volume
                                                          (DB + auth, internal only)
```

Three moving parts:

1. **PocketBase** — the database and auth store. Runs internally only; its port
   (8090) must **never** be exposed to the internet. Collection rules are locked
   to superuser-only, so only the Express server can read/write.
2. **Express API server** (`server/`) — the app's real backend: custom
   zero-knowledge auth, per-record sync/merge, calendar OAuth, push, integrations.
   Authenticates to PocketBase as the superuser.
3. **Static frontend** — pointed at the API server via `VITE_API_URL`.

### Ways to run it

- **Docker Compose (recommended):** `docker-compose.yml` wires PocketBase +
  the Express server together with a persistent `pb_data` volume. Frontend is
  deployed separately as static files pointed at the server's public URL. The
  compose file is annotated for Coolify but works on any Docker host.
- **Bare metal / VPS:** run PocketBase (`npm run pb:serve`) and the Node server
  (`npm run server`) as two long-lived processes (systemd, pm2, etc.) behind a
  reverse proxy that routes `/api` → :3001 and everything else → the static build.

### Required configuration

Copy `.env.example` → `.env` and set at minimum:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs auth tokens **and** derives the key that encrypts stored OAuth calendar tokens. Generate with `openssl rand -hex 32`. Rotating it forces users to reconnect calendars. |
| `POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD` | PocketBase superuser the Express server logs in as. Without these every data request fails closed. |
| `POCKETBASE_URL` | Where the server reaches PocketBase (default `http://127.0.0.1:8090`). |
| `FRONTEND_URL` | Comma-separated allowed origins (CORS). Set to your real site in production. |
| `VITE_API_URL` | Build-time: public URL of the API the frontend calls (e.g. `https://api.yourdomain.com/api`). |

Optional (leave unset to disable the feature):

- `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET`, `MS_OAUTH_CLIENT_ID` / `_SECRET` +
  `OAUTH_CALLBACK_BASE_URL` — connect Google / Microsoft calendars.
- Web-push / VAPID keys — browser push reminders.
- `GITHUB_RELEASES_REPO` (+ token) — the in-app "Download Desktop App" list.
- Infisical variables — fetch secrets from a vault instead of `.env`.

### What self-hosting tier 3 gives your users

Because the backend is the same code the hosted version runs, self-hosters get
the full account experience: zero-knowledge encrypted sync across devices, the
one-time recovery/backup key, connected calendars, and push — all on data that
never leaves your server. The server only ever stores ciphertext; the encryption
key is derived from each user's password on their own device.

### Security notes

- Expose **only** the Express API (:3001) and the static frontend. Never proxy
  or publish the PocketBase port (:8090).
- Back up the `pb_data` volume — without it, a redeploy wipes all user data.
- Zero-knowledge means a lost password + lost recovery key = unrecoverable data,
  even for you as the host. That's by design; the server cannot decrypt it.

---

## Which should I pick?

- **Just want to use it privately on one device?** Tier 1. Pick "No account".
- **Want it on your own domain but don't care about sync?** Tier 2.
- **Want accounts, multi-device sync, and calendar connections, all on your own
  server?** Tier 3 with Docker Compose.
