/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const events = app.findCollectionByNameOrId("events")

  addTextIfMissing(events, "label", 500)
  addTextIfMissing(events, "category", 120)
  addTextIfMissing(events, "color", 32)
  addSelectIfMissing(events, "calendar", ["plan", "actual"], true)
  addNumberIfMissing(events, "day_of_week", { required: true, onlyInt: true, min: 0, max: 6 })
  addNumberIfMissing(events, "slot_start", { required: true, onlyInt: true, min: 0 })
  addNumberIfMissing(events, "slot_duration", { required: true, onlyInt: true, min: 0 })
  addBoolIfMissing(events, "is_all_day")
  addTextIfMissing(events, "source", 120)
  addTextIfMissing(events, "source_calendar_id", 64)
  addTextIfMissing(events, "plan_event_id", 64)
  addTextIfMissing(events, "notes", 10000)
  addTextIfMissing(events, "updated_hlc", 64)
  addBoolIfMissing(events, "deleted")

  events.listRule = ""
  events.viewRule = ""
  events.createRule = ""
  events.updateRule = ""
  events.deleteRule = ""

  app.save(events)
}, (app) => {
  const events = app.findCollectionByNameOrId("events")

  removeIfExists(events, "deleted")
  removeIfExists(events, "updated_hlc")
  removeIfExists(events, "notes")
  removeIfExists(events, "plan_event_id")
  removeIfExists(events, "source_calendar_id")
  removeIfExists(events, "source")
  removeIfExists(events, "is_all_day")
  removeIfExists(events, "slot_duration")
  removeIfExists(events, "slot_start")
  removeIfExists(events, "day_of_week")
  removeIfExists(events, "calendar")
  removeIfExists(events, "color")
  removeIfExists(events, "category")
  removeIfExists(events, "label")

  app.save(events)
})

function addTextIfMissing(collection, name, max) {
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new TextField({
      name,
      max,
    }))
  }
}

function addSelectIfMissing(collection, name, values, required = false) {
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new SelectField({
      name,
      required,
      values,
      maxSelect: 1,
    }))
  }
}

function addNumberIfMissing(collection, name, options = {}) {
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new NumberField({
      name,
      ...options,
    }))
  }
}

function addBoolIfMissing(collection, name) {
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new BoolField({
      name,
    }))
  }
}

function removeIfExists(collection, name) {
  if (collection.fields.getByName(name)) {
    collection.fields.removeByName(name)
  }
}
