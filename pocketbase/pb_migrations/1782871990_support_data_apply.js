/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const signedInRule = "@request.auth.id != ''"

  upsertCollection(app, new Collection({
    type: "base",
    name: "linked_calendars",
    fields: [
      new RelationField({
        name: "user",
        collectionId: users.id,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "name", required: true, max: 200 }),
      new TextField({ name: "filename", max: 260 }),
      new SelectField({
        name: "calendar",
        required: true,
        values: ["plan", "actual"],
        maxSelect: 1,
      }),
      new TextField({ name: "imported_at", max: 80 }),
      new TextField({ name: "color", max: 32 }),
      new BoolField({ name: "exclude_from_reality" }),
      new URLField({ name: "url" }),
      new BoolField({ name: "sync_enabled" }),
      new NumberField({ name: "last_synced_at", onlyInt: true, min: 0 }),
      new SelectField({
        name: "source",
        required: true,
        values: ["ics", "google", "microsoft"],
        maxSelect: 1,
      }),
      new TextField({ name: "connection_id", max: 64 }),
      new TextField({ name: "external_calendar_id", max: 200 }),
    ],
  }), {
    createRule: signedInRule,
  })

  upsertCollection(app, new Collection({
    type: "base",
    name: "category_keywords",
    fields: [
      new RelationField({
        name: "user",
        collectionId: users.id,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "category_id", required: true, max: 120 }),
      new TextField({ name: "keyword", required: true, max: 200 }),
    ],
  }), {
    createRule: signedInRule,
  })

  upsertCollection(app, new Collection({
    type: "base",
    name: "user_llm_settings",
    fields: [
      new RelationField({
        name: "user",
        collectionId: users.id,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      }),
      new SelectField({
        name: "provider",
        required: true,
        values: ["none", "anthropic", "openai", "custom"],
        maxSelect: 1,
      }),
      new TextField({ name: "api_key", max: 500, hidden: true }),
      new URLField({ name: "endpoint" }),
      new TextField({ name: "model", max: 200 }),
    ],
  }), {
    createRule: signedInRule,
  })
}, (app) => {
  deleteCollectionIfExists(app, "user_llm_settings")
  deleteCollectionIfExists(app, "category_keywords")
  deleteCollectionIfExists(app, "linked_calendars")
})

function upsertCollection(app, collection, rules = null) {
  try {
    const existing = app.findCollectionByNameOrId(collection.name)
    collection.id = existing.id
  } catch {}

  app.save(collection)
  const saved = app.findCollectionByNameOrId(collection.name)

  if (rules) {
    saved.createRule = rules.createRule ?? saved.createRule
    app.save(saved)
  }

  return saved
}

function deleteCollectionIfExists(app, name) {
  try {
    const collection = app.findCollectionByNameOrId(name)
    app.delete(collection)
  } catch {}
}
