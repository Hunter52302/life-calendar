#!/bin/sh
set -e

# Idempotently ensure the superuser the Express server authenticates as exists.
# `superuser upsert` creates it on first boot and updates the password on later
# boots — safe to run every start. The same credentials are given to the server
# service so it can read/write the (superuser-locked) collections.
if [ -n "$POCKETBASE_ADMIN_EMAIL" ] && [ -n "$POCKETBASE_ADMIN_PASSWORD" ]; then
  echo "PocketBase    ->  upserting superuser $POCKETBASE_ADMIN_EMAIL"
  pocketbase superuser upsert "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD" \
    --dir=/pb/pb_data || echo "PocketBase    ->  superuser upsert skipped/failed (continuing)"
else
  echo "PocketBase    ->  POCKETBASE_ADMIN_EMAIL/PASSWORD not set; skipping superuser upsert"
fi

# Migrations in ./pb_migrations run automatically on serve.
exec pocketbase serve \
  --http=0.0.0.0:8090 \
  --dir=/pb/pb_data \
  --migrationsDir=/pb/pb_migrations
