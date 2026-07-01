# PocketBase rollout

## Goal

Move this app toward PocketBase without freezing desktop, iPad, or iPhone work.

## Phase 1

Use PocketBase for core app data first:

- users
- events
- categories
- habits
- budgets
- profile

## Phase 2

Move support data next:

- linked calendars
- category keywords
- LLM settings
- simple integrations

## Phase 3

Move the harder backend pieces last:

- calendar OAuth connections
- notification schedules
- push delivery
- admin secrets
- custom auth edge cases

## Why this order

This repo already has custom server logic around auth, sync, secrets, and scheduling.

PocketBase can still be the target, but the least painful path is:

1. move data first
2. move custom behavior after the data model is stable

## Local setup files

- setup guide: `pocketbase/README.md`
- migrations dir: `pocketbase/pb_migrations/`
- npm commands: `pb:*` scripts in `package.json`
