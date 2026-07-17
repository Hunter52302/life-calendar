/// <reference path="../pb_data/types.d.ts" />
//
// Repairs user_integrations.type, which never actually gained the "email" and
// "sms" values.
//
// The email and sms migrations guarded the widening on the field's type:
//
//     const typeField = collection.fields.getByName("type")
//     if (typeField && typeField.type === "select") {
//       typeField.values = [...typeField.values, "email"]
//     }
//
// On a field, `type` is a method, not a property, so `typeField.type` is a
// function and the comparison is never true. The widening never ran, while the
// email_address / phone_number columns added just below the guard did — which is
// why this looked shipped. The columns are there, but POSTing an integration of
// type "email" or "sms" fails the select's validation, PocketBase returns 400,
// and the bridge surfaces it as a 500.
//
// Assigning to typeField.values does write through to the collection, so the
// only thing the original migrations needed was to drop the guard.

const TYPE_VALUES = [
  "discord_webhook", "slack_webhook", "generic_webhook",
  "web_push", "expo_push", "email", "sms",
]

migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_integrations")
  const typeField = collection.fields.getByName("type")
  if (!typeField) return

  // Union rather than overwrite, so a value added by some other environment
  // isn't silently dropped from the set.
  const values = [...typeField.values]
  for (const value of TYPE_VALUES) {
    if (!values.includes(value)) values.push(value)
  }
  typeField.values = values

  app.save(collection)
}, (app) => {
  // Down: narrow back to the pre-email/sms set. Existing rows keep their stored
  // value — PocketBase only validates the select on write.
  try {
    const collection = app.findCollectionByNameOrId("user_integrations")
    const typeField = collection.fields.getByName("type")
    if (!typeField) return
    typeField.values = [...typeField.values].filter((v) => v !== "email" && v !== "sms")
    app.save(collection)
  } catch {}
})
