/// <reference path="../pb_data/types.d.ts" />
/* global migrate, TextField */
// Adds series_id: a shared plaintext identifier linking recurring/multi-day
// event instances that were created together, so edits/deletes can be scoped
// to the whole series (this / this+future / previous / all). It carries no
// content — just a random UUID — so it's safe to store unencrypted alongside
// the other structural fields (week_start, day_of_week, …).
migrate((app) => {
  const events = app.findCollectionByNameOrId("events")
  if (!events.fields.getByName("series_id")) {
    events.fields.add(new TextField({ name: "series_id", max: 50 }))
  }
  app.save(events)
}, (app) => {
  const events = app.findCollectionByNameOrId("events")
  if (events.fields.getByName("series_id")) {
    events.fields.removeByName("series_id")
  }
  app.save(events)
})
