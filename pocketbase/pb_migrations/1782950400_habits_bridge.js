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

function ensureUserText(collection) {
  const existing = collection.fields.getByName("user")
  if (existing && existing.type !== "text") {
    collection.fields.removeByName("user")
  }
  if (!collection.fields.getByName("user")) {
    collection.fields.addAt(0, new TextField({
      name: "user",
      required: true,
      max: 64,
    }))
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
