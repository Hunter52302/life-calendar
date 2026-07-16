/// <reference path="../pb_data/types.d.ts" />
//
// Adds SMS as a first-class notification channel:
//   • widens user_integrations.type to include "sms"
//   • adds a phone_number field to hold the recipient (E.164, e.g. +15551234567)
//
// Mirrors the idempotent "repair" style used by the e-mail integration migration
// so it is safe to run against a collection that already exists.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_integrations")

  // Widen the type select to include "sms" (preserving the existing values).
  const typeField = collection.fields.getByName("type")
  if (typeField && typeField.type === "select") {
    if (!typeField.values.includes("sms")) {
      typeField.values = [...typeField.values, "sms"]
    }
  }

  // Store the recipient phone number separately from endpoint_url / email_address.
  if (!collection.fields.getByName("phone_number")) {
    collection.fields.add(new TextField({ name: "phone_number", max: 32 }))
  }

  app.save(collection)
}, (app) => {
  // Down: narrow the select back and drop the field. Existing "sms" rows are
  // left untouched (PocketBase keeps stored values even if removed from the set).
  try {
    const collection = app.findCollectionByNameOrId("user_integrations")
    const typeField = collection.fields.getByName("type")
    if (typeField && typeField.type === "select") {
      typeField.values = typeField.values.filter((v) => v !== "sms")
    }
    collection.fields.removeByName("phone_number")
    app.save(collection)
  } catch {}
})
