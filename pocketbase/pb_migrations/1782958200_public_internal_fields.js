/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  repairUsers(app)
  repairUserAuthEnvelopes(app)
  repairUserLlmSettings(app)
  repairCalendarConnections(app)
  repairSecrets(app)
}, (app) => {
  repairUsers(app)
  repairUserAuthEnvelopes(app)
  repairUserLlmSettings(app)
  repairCalendarConnections(app)
  repairSecrets(app)
})

function replaceTextField(collection, name, options = {}, position = null) {
  const existing = collection.fields.getByName(name)
  if (existing) collection.fields.removeByName(name)
  const field = new TextField({ name, ...options })
  if (position === null) collection.fields.add(field)
  else collection.fields.addAt(position, field)
}

function repairUsers(app) {
  const collection = app.findCollectionByNameOrId("users")
  replaceTextField(collection, "app_user_id", { required: true, max: 64, hidden: false })
  replaceTextField(collection, "ics_feed_token", { max: 256, hidden: false })
  app.save(collection)
}

function repairUserAuthEnvelopes(app) {
  const collection = app.findCollectionByNameOrId("user_auth_envelopes")
  replaceTextField(collection, "password_hash", { required: true, max: 300, hidden: false })
  replaceTextField(collection, "auth_salt", { max: 200, hidden: false })
  replaceTextField(collection, "kdf_salt", { max: 200, hidden: false })
  replaceTextField(collection, "recovery_salt", { max: 200, hidden: false })
  replaceTextField(collection, "recovery_auth_salt", { max: 200, hidden: false })
  replaceTextField(collection, "recovery_verifier", { max: 300, hidden: false })
  replaceTextField(collection, "wrapped_dek_password", { max: 10000, hidden: false })
  replaceTextField(collection, "wrapped_dek_recovery", { max: 10000, hidden: false })
  app.save(collection)
}

function repairUserLlmSettings(app) {
  const collection = app.findCollectionByNameOrId("user_llm_settings")
  replaceTextField(collection, "api_key", { max: 500, hidden: false })
  app.save(collection)
}

function repairCalendarConnections(app) {
  const collection = app.findCollectionByNameOrId("calendar_connections")
  replaceTextField(collection, "access_token", { required: true, max: 20000, hidden: false })
  replaceTextField(collection, "refresh_token", { required: true, max: 20000, hidden: false })
  app.save(collection)
}

function repairSecrets(app) {
  const collection = app.findCollectionByNameOrId("secrets")
  replaceTextField(collection, "encrypted_previous_value", { max: 20000, hidden: false })
  app.save(collection)
}
