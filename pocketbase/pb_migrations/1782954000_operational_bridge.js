/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  upsertCollection(app, buildCalendarConnectionsCollection())
  upsertCollection(app, buildPushSubscriptionsCollection())
  upsertCollection(app, buildNotificationLogCollection())

  repairCalendarConnections(app)
  repairPushSubscriptions(app)
  repairNotificationLog(app)
}, (app) => {
  for (const name of ["calendar_connections", "push_subscriptions", "notification_log"]) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      collection.listRule = null
      collection.viewRule = null
      collection.createRule = "@request.auth.id != ''"
      collection.updateRule = null
      collection.deleteRule = null
      app.save(collection)
    } catch {}
  }
})

function buildCalendarConnectionsCollection() {
  return new Collection({
    type: "base",
    name: "calendar_connections",
    fields: [
      new TextField({ name: "user", required: true, max: 64 }),
      new TextField({ name: "connection_id", required: true, max: 64 }),
      new SelectField({
        name: "provider",
        required: true,
        values: ["google", "microsoft"],
        maxSelect: 1,
      }),
      new TextField({ name: "account_email", max: 200 }),
      new TextField({ name: "access_token", required: true, max: 20000, hidden: true }),
      new TextField({ name: "refresh_token", required: true, max: 20000, hidden: true }),
      new NumberField({ name: "token_expires_at", required: true, onlyInt: true }),
      new TextField({ name: "scope", max: 2000 }),
      new NumberField({ name: "created_at_epoch", required: true, onlyInt: true, min: 0 }),
    ],
  })
}

function buildPushSubscriptionsCollection() {
  return new Collection({
    type: "base",
    name: "push_subscriptions",
    fields: [
      new TextField({ name: "user", required: true, max: 64 }),
      new TextField({ name: "subscription_id", required: true, max: 64 }),
      new TextField({ name: "endpoint", required: true, max: 4000 }),
      new JSONField({ name: "subscription", required: true, maxSize: 50000 }),
      new NumberField({ name: "created_at_epoch", required: true, onlyInt: true, min: 0 }),
    ],
  })
}

function buildNotificationLogCollection() {
  return new Collection({
    type: "base",
    name: "notification_log",
    fields: [
      new TextField({ name: "user", required: true, max: 64 }),
      new TextField({ name: "log_id", required: true, max: 64 }),
      new TextField({ name: "integration_id", required: true, max: 64 }),
      new TextField({ name: "trigger_type", required: true, max: 200 }),
      new TextField({ name: "entity_id", max: 200 }),
      new TextField({ name: "fired_date", required: true, max: 16 }),
      new SelectField({
        name: "status",
        required: true,
        values: ["sent", "failed"],
        maxSelect: 1,
      }),
    ],
  })
}

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

function ensureSelectField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new SelectField({ name, ...options }))
}

function ensureNumberField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new NumberField({ name, ...options }))
}

function ensureJsonField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new JSONField({ name, ...options }))
}

function finalizeCollection(app, collection) {
  collection.listRule = ""
  collection.viewRule = ""
  collection.createRule = ""
  collection.updateRule = ""
  collection.deleteRule = ""
  app.save(collection)
}

function repairCalendarConnections(app) {
  const collection = app.findCollectionByNameOrId("calendar_connections")
  ensureTextField(collection, "user", { required: true, max: 64 }, 0)
  ensureTextField(collection, "connection_id", { required: true, max: 64 })
  ensureSelectField(collection, "provider", {
    required: true,
    values: ["google", "microsoft"],
    maxSelect: 1,
  })
  ensureTextField(collection, "account_email", { max: 200 })
  ensureTextField(collection, "access_token", { required: true, max: 20000, hidden: true })
  ensureTextField(collection, "refresh_token", { required: true, max: 20000, hidden: true })
  ensureNumberField(collection, "token_expires_at", { required: true, onlyInt: true })
  ensureTextField(collection, "scope", { max: 2000 })
  ensureNumberField(collection, "created_at_epoch", { required: true, onlyInt: true, min: 0 })
  finalizeCollection(app, collection)
}

function repairPushSubscriptions(app) {
  const collection = app.findCollectionByNameOrId("push_subscriptions")
  ensureTextField(collection, "user", { required: true, max: 64 }, 0)
  ensureTextField(collection, "subscription_id", { required: true, max: 64 })
  ensureTextField(collection, "endpoint", { required: true, max: 4000 })
  ensureJsonField(collection, "subscription", { required: true, maxSize: 50000 })
  ensureNumberField(collection, "created_at_epoch", { required: true, onlyInt: true, min: 0 })
  finalizeCollection(app, collection)
}

function repairNotificationLog(app) {
  const collection = app.findCollectionByNameOrId("notification_log")
  ensureTextField(collection, "user", { required: true, max: 64 }, 0)
  ensureTextField(collection, "log_id", { required: true, max: 64 })
  ensureTextField(collection, "integration_id", { required: true, max: 64 })
  ensureTextField(collection, "trigger_type", { required: true, max: 200 })
  ensureTextField(collection, "entity_id", { max: 200 })
  ensureTextField(collection, "fired_date", { required: true, max: 16 })
  ensureSelectField(collection, "status", {
    required: true,
    values: ["sent", "failed"],
    maxSelect: 1,
  })
  finalizeCollection(app, collection)
}
