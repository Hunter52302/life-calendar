/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  const signedInRule = "@request.auth.id != ''"

  upsertCollection(app, new Collection({
    type: "base",
    name: "events",
    fields: [
      new RelationField({
        name: "user",
        collectionId: users.id,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "label", required: true, max: 500 }),
      new TextField({ name: "category", max: 120 }),
      new TextField({ name: "color", max: 32 }),
      new SelectField({
        name: "calendar",
        required: true,
        values: ["plan", "actual"],
        maxSelect: 1,
      }),
      new DateField({ name: "week_start", required: true }),
      new NumberField({ name: "day_of_week", required: true, onlyInt: true, min: 0, max: 6 }),
      new NumberField({ name: "slot_start", required: true, onlyInt: true, min: 0 }),
      new NumberField({ name: "slot_duration", required: true, onlyInt: true, min: 1 }),
      new NumberField({ name: "precision", required: true, onlyInt: true, min: 1 }),
      new BoolField({ name: "is_all_day" }),
      new TextField({ name: "source", max: 120 }),
      new TextField({ name: "source_calendar_id", max: 64 }),
      new TextField({ name: "plan_event_id", max: 64 }),
      new TextField({ name: "notes", max: 10000 }),
      new TextField({ name: "updated_hlc", max: 64 }),
      new BoolField({ name: "deleted" }),
    ],
  }), {
    createRule: signedInRule,
  })

  upsertCollection(app, new Collection({
    type: "base",
    name: "custom_categories",
    fields: [
      new RelationField({
        name: "user",
        collectionId: users.id,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "label", required: true, max: 120 }),
      new TextField({ name: "color", required: true, max: 32 }),
    ],
  }), {
    createRule: signedInRule,
  })

  upsertCollection(app, new Collection({
    type: "base",
    name: "category_overrides",
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
      new TextField({ name: "label", max: 120 }),
      new TextField({ name: "color", max: 32 }),
    ],
  }), {
    createRule: signedInRule,
  })

  upsertCollection(app, new Collection({
    type: "base",
    name: "deleted_defaults",
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
    ],
  }), {
    createRule: signedInRule,
  })

  upsertCollection(app, new Collection({
    type: "base",
    name: "habits",
    fields: [
      new RelationField({
        name: "user",
        collectionId: users.id,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "label", required: true, max: 160 }),
      new TextField({ name: "color", required: true, max: 32 }),
      new JSONField({ name: "target_days", required: true, maxSize: 4096 }),
      new BoolField({ name: "active" }),
      new NumberField({ name: "sort_order", required: true, onlyInt: true, min: 0 }),
    ],
  }), {
    createRule: signedInRule,
  })

  const habits = app.findCollectionByNameOrId("habits")

  upsertCollection(app, new Collection({
    type: "base",
    name: "habit_completions",
    fields: [
      new RelationField({
        name: "habit",
        collectionId: habits.id,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      }),
      new RelationField({
        name: "user",
        collectionId: users.id,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      }),
      new DateField({ name: "date", required: true }),
    ],
  }), {
    createRule: signedInRule,
  })

  upsertCollection(app, new Collection({
    type: "base",
    name: "time_budgets",
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
      new NumberField({ name: "weekly_hours", required: true, min: 0 }),
    ],
  }), {
    createRule: signedInRule,
  })

  upsertCollection(app, new Collection({
    type: "base",
    name: "user_profile",
    fields: [
      new RelationField({
        name: "user",
        collectionId: users.id,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "username", max: 120 }),
      new TextField({ name: "display_name", max: 160 }),
      new EmailField({ name: "email" }),
      new JSONField({ name: "phone_numbers", maxSize: 8192 }),
      new TextField({ name: "birthday", max: 32 }),
      new TextField({ name: "home_address", max: 1000 }),
      new JSONField({ name: "other_addresses", maxSize: 16384 }),
    ],
  }), {
    createRule: signedInRule,
  })
}, (app) => {
  deleteCollectionIfExists(app, "user_profile")
  deleteCollectionIfExists(app, "time_budgets")
  deleteCollectionIfExists(app, "habit_completions")
  deleteCollectionIfExists(app, "habits")
  deleteCollectionIfExists(app, "deleted_defaults")
  deleteCollectionIfExists(app, "category_overrides")
  deleteCollectionIfExists(app, "custom_categories")
  deleteCollectionIfExists(app, "events")
})

function upsertCollection(app, collection, rules = null) {
  try {
    const existing = app.findCollectionByNameOrId(collection.name)
    collection.id = existing.id
  } catch {}

  app.save(collection)
  const saved = app.findCollectionByNameOrId(collection.name)

  if (rules) {
    saved.listRule = rules.listRule ?? saved.listRule
    saved.viewRule = rules.viewRule ?? saved.viewRule
    saved.createRule = rules.createRule ?? saved.createRule
    saved.updateRule = rules.updateRule ?? saved.updateRule
    saved.deleteRule = rules.deleteRule ?? saved.deleteRule
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
