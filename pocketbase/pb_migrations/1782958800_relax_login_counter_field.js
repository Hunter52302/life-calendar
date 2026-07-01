/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  repairUsers(app)
}, (app) => {
  repairUsers(app)
})

function replaceNumberField(collection, name, options = {}, position = null) {
  const existing = collection.fields.getByName(name)
  if (existing) collection.fields.removeByName(name)
  const field = new NumberField({ name, ...options })
  if (position === null) collection.fields.add(field)
  else collection.fields.addAt(position, field)
}

function repairUsers(app) {
  const collection = app.findCollectionByNameOrId("users")
  replaceNumberField(collection, "failed_login_attempts", {
    required: false,
    onlyInt: true,
    min: 0,
  })
  replaceNumberField(collection, "locked_until", {
    required: false,
    onlyInt: true,
    min: 0,
  })
  app.save(collection)
}
