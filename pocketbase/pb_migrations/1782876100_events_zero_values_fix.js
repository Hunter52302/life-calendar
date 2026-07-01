/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const events = app.findCollectionByNameOrId("events")

  const dayOfWeek = events.fields.getByName("day_of_week")
  if (dayOfWeek) {
    dayOfWeek.required = false
    dayOfWeek.onlyInt = true
    dayOfWeek.min = 0
    dayOfWeek.max = 6
  }

  const slotStart = events.fields.getByName("slot_start")
  if (slotStart) {
    slotStart.required = false
    slotStart.onlyInt = true
    slotStart.min = 0
  }

  app.save(events)
}, (app) => {
  const events = app.findCollectionByNameOrId("events")

  const dayOfWeek = events.fields.getByName("day_of_week")
  if (dayOfWeek) {
    dayOfWeek.required = true
  }

  const slotStart = events.fields.getByName("slot_start")
  if (slotStart) {
    slotStart.required = true
  }

  app.save(events)
})
