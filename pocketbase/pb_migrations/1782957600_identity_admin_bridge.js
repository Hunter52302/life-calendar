/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  repairUsers(app)
  upsertCollection(app, buildUserAuthEnvelopesCollection())
  upsertCollection(app, buildSecretsCollection())
  upsertCollection(app, buildAdminAuditLogCollection())
  upsertCollection(app, buildDiscordBotUsersCollection())

  repairUserAuthEnvelopes(app)
  repairSecrets(app)
  repairAdminAuditLog(app)
  repairDiscordBotUsers(app)
}, (app) => {
  for (const name of ["users", "user_auth_envelopes", "secrets", "admin_audit_log", "discord_bot_users"]) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      collection.listRule = null
      collection.viewRule = null
      collection.createRule = null
      collection.updateRule = null
      collection.deleteRule = null
      app.save(collection)
    } catch {}
  }
})

function upsertCollection(app, collection) {
  try {
    const existing = app.findCollectionByNameOrId(collection.name)
    collection.id = existing.id
  } catch {}
  app.save(collection)
  return app.findCollectionByNameOrId(collection.name)
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

function ensureBoolField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new BoolField({ name, ...options }))
}

function ensureNumberField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new NumberField({ name, ...options }))
}

function finalizeCollection(app, collection) {
  collection.listRule = ""
  collection.viewRule = ""
  collection.createRule = ""
  collection.updateRule = ""
  collection.deleteRule = ""
  app.save(collection)
}

function repairUsers(app) {
  const collection = app.findCollectionByNameOrId("users")
  ensureTextField(collection, "app_user_id", { required: true, max: 64, hidden: true })
  ensureTextField(collection, "role", { required: true, max: 32 })
  ensureBoolField(collection, "is_blocked")
  ensureBoolField(collection, "zk_enabled")
  ensureTextField(collection, "user_timezone", { required: true, max: 128 })
  ensureNumberField(collection, "failed_login_attempts", { onlyInt: true, min: 0 })
  ensureNumberField(collection, "locked_until", { onlyInt: true, min: 0 })
  ensureTextField(collection, "signup_ip", { max: 128 })
  ensureTextField(collection, "ics_feed_token", { max: 256, hidden: true })
  finalizeCollection(app, collection)
}

function buildUserAuthEnvelopesCollection() {
  return new Collection({
    type: "base",
    name: "user_auth_envelopes",
    fields: [
      new TextField({ name: "app_user_id", required: true, max: 64 }),
      new TextField({ name: "password_hash", required: true, max: 300, hidden: true }),
      new TextField({ name: "auth_salt", max: 200, hidden: true }),
      new TextField({ name: "kdf_salt", max: 200, hidden: true }),
      new TextField({ name: "recovery_salt", max: 200, hidden: true }),
      new TextField({ name: "recovery_auth_salt", max: 200, hidden: true }),
      new TextField({ name: "recovery_verifier", max: 300, hidden: true }),
      new TextField({ name: "wrapped_dek_password", max: 10000, hidden: true }),
      new TextField({ name: "wrapped_dek_recovery", max: 10000, hidden: true }),
    ],
  })
}

function buildSecretsCollection() {
  return new Collection({
    type: "base",
    name: "secrets",
    fields: [
      new TextField({ name: "key_name", required: true, max: 128 }),
      new TextField({ name: "service_name", required: true, max: 200 }),
      new TextField({ name: "description", max: 2000 }),
      new TextField({ name: "encrypted_previous_value", max: 20000, hidden: true }),
      new NumberField({ name: "expires_at", onlyInt: true, min: 0 }),
      new BoolField({ name: "infisical_managed" }),
      new NumberField({ name: "created_at_epoch", required: true, onlyInt: true, min: 0 }),
      new NumberField({ name: "updated_at_epoch", required: true, onlyInt: true, min: 0 }),
    ],
  })
}

function buildAdminAuditLogCollection() {
  return new Collection({
    type: "base",
    name: "admin_audit_log",
    fields: [
      new TextField({ name: "audit_id", required: true, max: 64 }),
      new TextField({ name: "admin_user_id", required: true, max: 64 }),
      new TextField({ name: "action", required: true, max: 200 }),
      new TextField({ name: "target_user_id", max: 64 }),
      new NumberField({ name: "created_at_epoch", required: true, onlyInt: true, min: 0 }),
    ],
  })
}

function buildDiscordBotUsersCollection() {
  return new Collection({
    type: "base",
    name: "discord_bot_users",
    fields: [
      new TextField({ name: "user", required: true, max: 64 }),
      new TextField({ name: "discord_user_id", required: true, max: 200 }),
      new NumberField({ name: "paired_at_epoch", required: true, onlyInt: true, min: 0 }),
    ],
  })
}

function repairUserAuthEnvelopes(app) {
  const collection = app.findCollectionByNameOrId("user_auth_envelopes")
  ensureTextField(collection, "app_user_id", { required: true, max: 64 }, 0)
  ensureTextField(collection, "password_hash", { required: true, max: 300, hidden: true })
  ensureTextField(collection, "auth_salt", { max: 200, hidden: true })
  ensureTextField(collection, "kdf_salt", { max: 200, hidden: true })
  ensureTextField(collection, "recovery_salt", { max: 200, hidden: true })
  ensureTextField(collection, "recovery_auth_salt", { max: 200, hidden: true })
  ensureTextField(collection, "recovery_verifier", { max: 300, hidden: true })
  ensureTextField(collection, "wrapped_dek_password", { max: 10000, hidden: true })
  ensureTextField(collection, "wrapped_dek_recovery", { max: 10000, hidden: true })
  finalizeCollection(app, collection)
}

function repairSecrets(app) {
  const collection = app.findCollectionByNameOrId("secrets")
  ensureTextField(collection, "key_name", { required: true, max: 128 }, 0)
  ensureTextField(collection, "service_name", { required: true, max: 200 })
  ensureTextField(collection, "description", { max: 2000 })
  ensureTextField(collection, "encrypted_previous_value", { max: 20000, hidden: true })
  ensureNumberField(collection, "expires_at", { onlyInt: true, min: 0 })
  ensureBoolField(collection, "infisical_managed")
  ensureNumberField(collection, "created_at_epoch", { required: true, onlyInt: true, min: 0 })
  ensureNumberField(collection, "updated_at_epoch", { required: true, onlyInt: true, min: 0 })
  finalizeCollection(app, collection)
}

function repairAdminAuditLog(app) {
  const collection = app.findCollectionByNameOrId("admin_audit_log")
  ensureTextField(collection, "audit_id", { required: true, max: 64 }, 0)
  ensureTextField(collection, "admin_user_id", { required: true, max: 64 })
  ensureTextField(collection, "action", { required: true, max: 200 })
  ensureTextField(collection, "target_user_id", { max: 64 })
  ensureNumberField(collection, "created_at_epoch", { required: true, onlyInt: true, min: 0 })
  finalizeCollection(app, collection)
}

function repairDiscordBotUsers(app) {
  const collection = app.findCollectionByNameOrId("discord_bot_users")
  ensureTextField(collection, "user", { required: true, max: 64 }, 0)
  ensureTextField(collection, "discord_user_id", { required: true, max: 200 })
  ensureNumberField(collection, "paired_at_epoch", { required: true, onlyInt: true, min: 0 })
  finalizeCollection(app, collection)
}
