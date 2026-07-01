# PocketBase setup

This repo now expects the PocketBase binary to live here:

- `pocketbase/pocketbase`

PocketBase docs say the binary will create:

- `pb_data/` for app data
- `pb_migrations/` for migration files

## First local setup

1. Download the PocketBase binary for macOS from:
   - [PocketBase Docs](https://pocketbase.io/docs/)
2. Put it at:
   - `pocketbase/pocketbase`
3. Make it executable:
   - `chmod +x pocketbase/pocketbase`
4. Start it:
   - `npm run pb:serve`

Local URLs:

- app: `http://127.0.0.1:8090`
- dashboard: `http://127.0.0.1:8090/_/`
- API: `http://127.0.0.1:8090/api/`

## Migrations

PocketBase docs say:

- new migrations inside `pb_migrations/` run automatically on `serve`
- `migrate create` makes a blank migration
- `migrate collections` makes a full collections snapshot
- `migrate history-sync` cleans local migration history after squashing files

Repo commands:

- `npm run pb:serve`
- `npm run pb:migrate:create -- your_name_here`
- `npm run pb:migrate:collections`
- `npm run pb:migrate:history-sync`

## Suggested phase 1 collections

Start with these first:

- `users` as an auth collection
- `events`
- `custom_categories`
- `category_overrides`
- `linked_calendars`
- `habits`
- `habit_completions`
- `time_budgets`
- `user_profile`

Keep these for a later pass:

- `calendar_connections`
- `user_integrations`
- `notification_schedules`
- `push_subscriptions`
- `secrets`
- admin-only flows

## Important note for this repo

PocketBase auth is stateless. The docs note there is no server-side session store and no logout endpoint.

That means the current custom auth flow in `server/` should not be replaced in one jump.

Use PocketBase first for data shape and collections, then move auth and server-side behavior in slices.
