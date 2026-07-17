/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  repairHabits(app)
  repairHabitCompletions(app)
}, (app) => {
  for (const name of ["habits", "habit_completions"]) {
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

function repairHabits(app) {
  const collection = app.findCollectionByNameOrId("habits")
  ensureUserText(collection)
  ensureTextField(collection, "habit_id", { required: true, max: 64 })
  ensureTextField(collection, "label", { required: true, max: 2000 })
  ensureTextField(collection, "color", { required: true, max: 32 })
  ensureJsonField(collection, "target_days", { maxSize: 2048 })
  ensureBoolField(collection, "active")
  ensureNumberField(collection, "sort_order", { onlyInt: true })
  ensureTextField(collection, "integration_hint", { max: 500 })
  finalizeCollection(app, collection)
}

function repairHabitCompletions(app) {
  const collection = app.findCollectionByNameOrId("habit_completions")
  ensureUserText(collection)
  ensureTextField(collection, "completion_id", { required: true, max: 64 })
  ensureTextField(collection, "habit_id", { required: true, max: 64 })
  ensureTextField(collection, "date", { required: true, max: 32 })
  finalizeCollection(app, collection)
}
