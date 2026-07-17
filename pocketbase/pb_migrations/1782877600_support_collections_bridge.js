/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  repairCustomCategories(app)
  repairCategoryOverrides(app)
  repairDeletedDefaults(app)
  repairLinkedCalendars(app)
  repairTimeBudgets(app)
  repairUserProfile(app)
  repairCategoryKeywords(app)
  repairUserLlmSettings(app)
}, (app) => {
  const openCollections = [
    "custom_categories",
    "category_overrides",
    "deleted_defaults",
    "linked_calendars",
    "time_budgets",
    "user_profile",
    "category_keywords",
    "user_llm_settings",
  ]

  for (const name of openCollections) {
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

function ensureBoolField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new BoolField({ name, ...options }))
}

function ensureNumberField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new NumberField({ name, ...options }))
}

function ensureJsonField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new JSONField({ name, ...options }))
}

function ensureEmailField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new EmailField({ name, ...options }))
}

function ensureUrlField(collection, name, options = {}) {
  collection.fields.removeByName(name)
  collection.fields.add(new URLField({ name, ...options }))
}

function ensureUserText(collection) {
  ensureTextField(collection, "user", { required: true, max: 64 }, 0)
}

function finalizeCollection(app, collection) {
  collection.listRule = ""
  collection.viewRule = ""
  collection.createRule = ""
  collection.updateRule = ""
  collection.deleteRule = ""
  app.save(collection)
}

function repairCustomCategories(app) {
  const collection = app.findCollectionByNameOrId("custom_categories")
  ensureUserText(collection)
  ensureTextField(collection, "custom_id", { required: true, max: 64 })
  ensureTextField(collection, "label", { required: true, max: 120 })
  ensureTextField(collection, "color", { required: true, max: 32 })
  finalizeCollection(app, collection)
}

function repairCategoryOverrides(app) {
  const collection = app.findCollectionByNameOrId("category_overrides")
  ensureUserText(collection)
  ensureTextField(collection, "category_id", { required: true, max: 120 })
  ensureTextField(collection, "label", { max: 120 })
  ensureTextField(collection, "color", { max: 32 })
  finalizeCollection(app, collection)
}

function repairDeletedDefaults(app) {
  const collection = app.findCollectionByNameOrId("deleted_defaults")
  ensureUserText(collection)
  ensureTextField(collection, "category_id", { required: true, max: 120 })
  finalizeCollection(app, collection)
}

function repairLinkedCalendars(app) {
  const collection = app.findCollectionByNameOrId("linked_calendars")
  ensureUserText(collection)
  ensureTextField(collection, "calendar_id", { required: true, max: 64 })
  ensureTextField(collection, "name", { required: true, max: 200 })
  ensureTextField(collection, "filename", { max: 260 })
  ensureSelectField(collection, "calendar", {
    required: true,
    values: ["plan", "actual"],
    maxSelect: 1,
  })
  ensureTextField(collection, "imported_at", { max: 80 })
  ensureTextField(collection, "color", { max: 32 })
  ensureBoolField(collection, "exclude_from_reality")
  ensureUrlField(collection, "url")
  ensureBoolField(collection, "sync_enabled")
  ensureNumberField(collection, "last_synced_at", { onlyInt: true, min: 0 })
  ensureSelectField(collection, "source", {
    required: true,
    values: ["ics", "google", "microsoft"],
    maxSelect: 1,
  })
  ensureTextField(collection, "connection_id", { max: 64 })
  ensureTextField(collection, "external_calendar_id", { max: 200 })
  finalizeCollection(app, collection)
}

function repairTimeBudgets(app) {
  const collection = app.findCollectionByNameOrId("time_budgets")
  ensureUserText(collection)
  ensureTextField(collection, "category_id", { required: true, max: 120 })
  ensureNumberField(collection, "weekly_hours", { min: 0 })
  finalizeCollection(app, collection)
}

function repairUserProfile(app) {
  const collection = app.findCollectionByNameOrId("user_profile")
  ensureUserText(collection)
  ensureTextField(collection, "username", { max: 120 })
  ensureTextField(collection, "display_name", { max: 160 })
  ensureEmailField(collection, "email")
  ensureJsonField(collection, "phone_numbers", { maxSize: 8192 })
  ensureTextField(collection, "birthday", { max: 32 })
  ensureTextField(collection, "home_address", { max: 1000 })
  ensureJsonField(collection, "other_addresses", { maxSize: 16384 })
  finalizeCollection(app, collection)
}

function repairCategoryKeywords(app) {
  const collection = app.findCollectionByNameOrId("category_keywords")
  ensureUserText(collection)
  ensureTextField(collection, "category_id", { required: true, max: 120 })
  ensureTextField(collection, "keyword", { required: true, max: 200 })
  finalizeCollection(app, collection)
}

function repairUserLlmSettings(app) {
  const collection = app.findCollectionByNameOrId("user_llm_settings")
  ensureUserText(collection)
  ensureSelectField(collection, "provider", {
    required: true,
    values: ["none", "anthropic", "openai", "custom"],
    maxSelect: 1,
  })
  ensureTextField(collection, "api_key", { max: 500, hidden: true })
  ensureUrlField(collection, "endpoint")
  ensureTextField(collection, "model", { max: 200 })
  finalizeCollection(app, collection)
}
