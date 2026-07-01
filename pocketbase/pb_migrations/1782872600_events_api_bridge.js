/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const events = app.findCollectionByNameOrId("events")

  events.fields.removeByName("user")
  events.fields.addAt(0, new TextField({
    name: "user",
    required: true,
    max: 64,
  }))

  events.fields.removeByName("week_start")
  events.fields.add(new TextField({
    name: "week_start",
    required: true,
    max: 32,
  }))

  events.fields.removeByName("precision")
  events.fields.add(new NumberField({
    name: "precision",
    required: true,
    min: 0.5,
    max: 1,
  }))

  if (!events.fields.getByName("event_id")) {
    events.fields.add(new TextField({
      name: "event_id",
      required: true,
      max: 64,
    }))
  }

  events.listRule = ""
  events.viewRule = ""
  events.createRule = ""
  events.updateRule = ""
  events.deleteRule = ""

  app.save(events)
}, (app) => {
  const events = app.findCollectionByNameOrId("events")

  events.fields.removeByName("event_id")

  events.fields.removeByName("user")
  events.fields.addAt(0, new RelationField({
    name: "user",
    collectionId: app.findCollectionByNameOrId("users").id,
    required: true,
    minSelect: 1,
    maxSelect: 1,
    cascadeDelete: true,
  }))

  events.fields.removeByName("week_start")
  events.fields.add(new DateField({
    name: "week_start",
    required: true,
  }))

  events.fields.removeByName("precision")
  events.fields.add(new NumberField({
    name: "precision",
    required: true,
    onlyInt: true,
    min: 1,
  }))

  events.listRule = null
  events.viewRule = null
  events.createRule = "@request.auth.id != ''"
  events.updateRule = null
  events.deleteRule = null

  app.save(events)
})
