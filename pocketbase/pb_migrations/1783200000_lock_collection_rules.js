/// <reference path="../pb_data/types.d.ts" />
//
// SECURITY: lock every collection's API rules to superuser-only.
//
// Earlier "bridge" migrations set all rules to "" (public) so the Express
// server could reach PocketBase without authenticating. That left the entire
// data layer — including user_auth_envelopes (bcrypt hashes, salts, wrapped
// DEKs), secrets, and OAuth tokens — readable and writable by anyone who could
// reach the PocketBase port, defeating the zero-knowledge guarantee.
//
// The Express server now authenticates as a superuser (server/lib/pbClient.js),
// and superusers bypass collection API rules, so setting every rule to null
// (superuser-only) closes the data layer to everyone else while the app keeps
// working. This migration MUST ship together with the authenticated client.

const COLLECTIONS = [
  "events", "custom_categories", "category_overrides", "deleted_defaults",
  "linked_calendars", "habits", "habit_completions", "time_budgets",
  "user_integrations", "notification_schedules", "push_subscriptions",
  "notification_log", "user_profile", "category_keywords", "user_llm_settings",
  "calendar_connections", "discord_bot_users",
  "users", "user_auth_envelopes", "secrets", "admin_audit_log",
];

migrate((app) => {
  for (const name of COLLECTIONS) {
    try {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = null;
      c.viewRule = null;
      c.createRule = null;
      c.updateRule = null;
      c.deleteRule = null;
      app.save(c);
    } catch (_) { /* collection may not exist in a given environment */ }
  }
}, (app) => {
  // Down: reopen the public bridge rules. NOT recommended — this re-exposes the
  // data layer to unauthenticated access. Provided only for migration symmetry.
  for (const name of COLLECTIONS) {
    try {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = "";
      c.viewRule = "";
      c.createRule = "";
      c.updateRule = "";
      c.deleteRule = "";
      app.save(c);
    } catch (_) { /* ignore */ }
  }
});
