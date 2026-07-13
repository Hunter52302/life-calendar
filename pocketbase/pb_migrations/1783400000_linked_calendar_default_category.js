/// <reference path="../pb_data/types.d.ts" />
/* global migrate, TextField */
// Adds default_category to linked_calendars: an optional category id that every
// event imported from this calendar is tagged with (e.g. a "Work" Google
// calendar → all its events get the "work" category). It's a plaintext
// structural field like `color` — no event content — so it's safe unencrypted.
// Applied at import time, so it survives the destructive re-sync that recreates
// a calendar's events on every refresh.
migrate((app) => {
  const cals = app.findCollectionByNameOrId("linked_calendars")
  if (!cals.fields.getByName("default_category")) {
    cals.fields.add(new TextField({ name: "default_category", max: 120 }))
  }
  app.save(cals)
}, (app) => {
  const cals = app.findCollectionByNameOrId("linked_calendars")
  if (cals.fields.getByName("default_category")) {
    cals.fields.removeByName("default_category")
  }
  app.save(cals)
})
