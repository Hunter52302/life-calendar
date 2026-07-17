/// <reference path="../pb_data/types.d.ts" />
//
// "Sign in with Google" as a LINKED login provider (not account recovery).
//
// The LifeCalendar account stays canonical; Google is an additive way to
// authenticate into it. Because the app is zero-knowledge, Google proving
// identity doesn't hand the client a key — so we add a THIRD wrap of the DEK
// (wrapped_dek_google) alongside the existing password/recovery wraps. It's
// unwrapped by a random secret the server releases only after a verified Google
// sign-in (the one server-assisted door; password + recovery stay fully ZK).
//
//   user_auth_envelopes : + wrapped_dek_google, google_unlock_secret
//   users               : + google_sub, google_email + pending_* link state
//   google_auth_tickets : single-use, short-lived login-exchange codes
//
// All rules stay superuser-only (null), matching 1783200000_lock_collection_rules.js.
migrate((app) => {
  // ── user_auth_envelopes: the Google DEK wrap + its unlock secret ──────────
  const envelopes = app.findCollectionByNameOrId("user_auth_envelopes")
  ensureTextField(envelopes, "wrapped_dek_google", { max: 10000, hidden: true })
  ensureTextField(envelopes, "google_unlock_secret", { max: 10000, hidden: true })
  lockRules(envelopes)
  app.save(envelopes)

  // ── users: committed Google identity + pending-link handshake state ───────
  const users = app.findCollectionByNameOrId("users")
  ensureTextField(users, "google_sub", { max: 128, hidden: true })
  ensureTextField(users, "google_email", { max: 200 })
  ensureTextField(users, "pending_google_sub", { max: 128, hidden: true })
  ensureTextField(users, "pending_google_email", { max: 200, hidden: true })
  ensureNumberField(users, "pending_google_expires", { onlyInt: true, min: 0 })
  app.save(users)

  // ── google_auth_tickets: single-use login exchange codes ──────────────────
  upsertCollection(app, new Collection({
    type: "base",
    name: "google_auth_tickets",
    fields: [
      new TextField({ name: "jti", required: true, max: 64 }),
      new TextField({ name: "app_user_id", required: true, max: 64 }),
      new NumberField({ name: "expires", required: true, onlyInt: true, min: 0 }),
    ],
  }))
  const tickets = app.findCollectionByNameOrId("google_auth_tickets")
  ensureTextField(tickets, "jti", { required: true, max: 64 }, 0)
  ensureTextField(tickets, "app_user_id", { required: true, max: 64 })
  ensureNumberField(tickets, "expires", { required: true, onlyInt: true, min: 0 })
  lockRules(tickets)
  app.save(tickets)
}, (app) => {
  // Down: drop the added fields; leave the (now-empty) tickets collection.
  try {
    const envelopes = app.findCollectionByNameOrId("user_auth_envelopes")
    envelopes.fields.removeByName("wrapped_dek_google")
    envelopes.fields.removeByName("google_unlock_secret")
    app.save(envelopes)
  } catch (_) { /* ignore */ }
  try {
    const users = app.findCollectionByNameOrId("users")
    for (const f of ["google_sub", "google_email", "pending_google_sub", "pending_google_email", "pending_google_expires"]) {
      users.fields.removeByName(f)
    }
    app.save(users)
  } catch (_) { /* ignore */ }
  try {
    app.delete(app.findCollectionByNameOrId("google_auth_tickets"))
  } catch (_) { /* ignore */ }
})

function upsertCollection(app, collection) {
  try {
    const existing = app.findCollectionByNameOrId(collection.name)
    collection.id = existing.id
  } catch (_) { /* new collection */ }
  app.save(collection)
  return app.findCollectionByNameOrId(collection.name)
}

function lockRules(collection) {
  collection.listRule = null
  collection.viewRule = null
  collection.createRule = null
  collection.updateRule = null
  collection.deleteRule = null
}

// Field helpers: each removes the field and re-adds it from the canonical spec.
// The rebuild is unconditional by design. It used to sit behind
// `existing.type !== "text"`, which was never false — `type` is a method on a
// field, not a property — so this is the behavior that has always run.
//
// Safe on a populated collection: PocketBase derives a field's id from its name,
// so re-adding under the same name and type regenerates the same id and replaces
// the field in place, keeping the column and its rows. Only a real type change
// yields a new id and rebuilds the column, which is the repair these helpers
// exist to perform.
function ensureTextField(collection, name, options = {}, position = null) {
  collection.fields.removeByName(name)
  const field = new TextField({ name, ...options })
  if (position === null) collection.fields.add(field)
  else collection.fields.addAt(position, field)
}

function ensureNumberField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new NumberField({ name, ...options }))
}
