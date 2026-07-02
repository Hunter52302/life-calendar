/// <reference path="../pb_data/types.d.ts" />
/* global migrate, TextField, NumberField, JSONField */
migrate((app) => {
  const events = app.findCollectionByNameOrId("events")

  addTextIfMissing(events, "location", 1000)
  addTextIfMissing(events, "meeting_url", 1000)
  addNumberIfMissing(events, "travel_buffer_minutes", { onlyInt: true, min: 0 })
  addJsonIfMissing(events, "people", { maxSize: 20000 })
  addJsonIfMissing(events, "actions", { maxSize: 20000 })

  app.save(events)
}, (app) => {
  const events = app.findCollectionByNameOrId("events")

  removeIfExists(events, "actions")
  removeIfExists(events, "people")
  removeIfExists(events, "travel_buffer_minutes")
  removeIfExists(events, "meeting_url")
  removeIfExists(events, "location")

  app.save(events)
})

function addTextIfMissing(collection, name, max) {
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new TextField({ name, max }))
  }
}

function addNumberIfMissing(collection, name, options = {}) {
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new NumberField({ name, ...options }))
  }
}

function addJsonIfMissing(collection, name, options = {}) {
  if (!collection.fields.getByName(name)) {
    collection.fields.add(new JSONField({ name, ...options }))
  }
}

function removeIfExists(collection, name) {
  if (collection.fields.getByName(name)) {
    collection.fields.removeByName(name)
  }
}
