/// <reference path="../pb_data/types.d.ts" />
//
// Adds e-mail as a first-class notification channel:
//   • widens user_integrations.type to include "email"
//   • adds an email_address field to hold the recipient
//
// Mirrors the idempotent "repair" style used by the other bridge migrations so
// it is safe to run against a collection that already exists.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_integrations")

  // Widen the type select to include "email" (preserving the existing values).
  const typeField = collection.fields.getByName("type")
  if (typeField && typeField.type === "select") {
    if (!typeField.values.includes("email")) {
      typeField.values = [...typeField.values, "email"]
    }
  }

  // Store the recipient address separately from endpoint_url (which is a URL
  // field and would reject a bare e-mail address).
  if (!collection.fields.getByName("email_address")) {
    collection.fields.add(new TextField({ name: "email_address", max: 320 }))
  }

  app.save(collection)
}, (app) => {
  // Down: narrow the select back and drop the field. Existing "email" rows are
  // left untouched (PocketBase keeps stored values even if removed from the set).
  try {
    const collection = app.findCollectionByNameOrId("user_integrations")
    const typeField = collection.fields.getByName("type")
    if (typeField && typeField.type === "select") {
      typeField.values = typeField.values.filter((v) => v !== "email")
    }
    collection.fields.removeByName("email_address")
    app.save(collection)
  } catch {}
})
