/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  upsertCollection(app, buildUserIntegrationsCollection())
  upsertCollection(app, buildNotificationSchedulesCollection())

  repairUserIntegrations(app)
  repairNotificationSchedules(app)
}, (app) => {
  for (const name of ["user_integrations", "notification_schedules"]) {
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

function buildUserIntegrationsCollection() {
  return new Collection({
    type: "base",
    name: "user_integrations",
    fields: [
      new TextField({ name: "user", required: true, max: 64 }),
      new TextField({ name: "integration_id", required: true, max: 64 }),
      new SelectField({
        name: "type",
        required: true,
        values: ["discord_webhook", "slack_webhook", "generic_webhook", "web_push", "expo_push"],
        maxSelect: 1,
      }),
      new TextField({ name: "label", max: 200 }),
      new URLField({ name: "endpoint_url" }),
      new TextField({ name: "push_token", max: 1000 }),
      new BoolField({ name: "include_hints" }),
      new BoolField({ name: "enabled" }),
    ],
  })
}

function buildNotificationSchedulesCollection() {
  return new Collection({
    type: "base",
    name: "notification_schedules",
    fields: [
      new TextField({ name: "user", required: true, max: 64 }),
      new TextField({ name: "schedule_id", required: true, max: 64 }),
      new TextField({ name: "integration_id", max: 64 }),
      new SelectField({
        name: "trigger_type",
        required: true,
        values: ["event_reminder", "habit_reminder", "daily_summary", "streak_milestone"],
        maxSelect: 1,
      }),
      new NumberField({ name: "offset_minutes", onlyInt: true }),
      new TextField({ name: "time_of_day", max: 16 }),
      new JSONField({ name: "days_of_week", maxSize: 2048 }),
      new BoolField({ name: "enabled" }),
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

function ensureTextField(collection, name, options = {}, position = null) {
  const existing = collection.fields.getByName(name)
  if (existing && existing.type !== "text") {
    collection.fields.removeByName(name)
  }
  if (!collection.fields.getByName(name)) {
    const field = new TextField({ name, ...options })
    if (position === null) collection.fields.add(field)
    else collection.fields.addAt(position, field)
  }
}

function ensureSelectField(collection, name, options = {}) {
  const existing = collection.fields.getByName(name)
  if (existing && existing.type !== "select") {
    collection.fields.removeByName(name)
  }
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new SelectField({ name, ...options }))
  }
}

function ensureBoolField(collection, name, options = {}) {
  const existing = collection.fields.getByName(name)
  if (existing && existing.type !== "bool") {
    collection.fields.removeByName(name)
  }
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new BoolField({ name, ...options }))
  }
}

function ensureNumberField(collection, name, options = {}) {
  const existing = collection.fields.getByName(name)
  if (existing && existing.type !== "number") {
    collection.fields.removeByName(name)
  }
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new NumberField({ name, ...options }))
  }
}

function ensureJsonField(collection, name, options = {}) {
  const existing = collection.fields.getByName(name)
  if (existing && existing.type !== "json") {
    collection.fields.removeByName(name)
  }
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new JSONField({ name, ...options }))
  }
}

function ensureUrlField(collection, name, options = {}) {
  const existing = collection.fields.getByName(name)
  if (existing && existing.type !== "url") {
    collection.fields.removeByName(name)
  }
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new URLField({ name, ...options }))
  }
}

function finalizeCollection(app, collection) {
  collection.listRule = ""
  collection.viewRule = ""
  collection.createRule = ""
  collection.updateRule = ""
  collection.deleteRule = ""
  app.save(collection)
}

function repairUserIntegrations(app) {
  const collection = app.findCollectionByNameOrId("user_integrations")
  ensureTextField(collection, "user", { required: true, max: 64 }, 0)
  ensureTextField(collection, "integration_id", { required: true, max: 64 })
  ensureSelectField(collection, "type", {
    required: true,
    values: ["discord_webhook", "slack_webhook", "generic_webhook", "web_push", "expo_push"],
    maxSelect: 1,
  })
  ensureTextField(collection, "label", { max: 200 })
  ensureUrlField(collection, "endpoint_url")
  ensureTextField(collection, "push_token", { max: 1000 })
  ensureBoolField(collection, "include_hints")
  ensureBoolField(collection, "enabled")
  finalizeCollection(app, collection)
}

function repairNotificationSchedules(app) {
  const collection = app.findCollectionByNameOrId("notification_schedules")
  ensureTextField(collection, "user", { required: true, max: 64 }, 0)
  ensureTextField(collection, "schedule_id", { required: true, max: 64 })
  ensureTextField(collection, "integration_id", { max: 64 })
  ensureSelectField(collection, "trigger_type", {
    required: true,
    values: ["event_reminder", "habit_reminder", "daily_summary", "streak_milestone"],
    maxSelect: 1,
  })
  ensureNumberField(collection, "offset_minutes", { onlyInt: true })
  ensureTextField(collection, "time_of_day", { max: 16 })
  ensureJsonField(collection, "days_of_week", { maxSize: 2048 })
  ensureBoolField(collection, "enabled")
  finalizeCollection(app, collection)
}
