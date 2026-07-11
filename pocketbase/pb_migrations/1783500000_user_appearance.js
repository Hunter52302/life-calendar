/// <reference path="../pb_data/types.d.ts" />
// Per-user appearance record: background image + visual controls, stored as one
// JSON blob so the client owns its shape. The image lives inside that blob as a
// downscaled data URL (already encrypted when zero-knowledge sync is on), hence
// the generous maxSize. Synced to the frontend via /api/sync and /api/appearance.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  const collection = upsertCollection(app, new Collection({
    type: "base",
    name: "user_appearance",
    fields: [
      new RelationField({
        name: "user",
        collectionId: users.id,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      }),
      new JSONField({ name: "data", maxSize: 8388608 }),
    ],
  }))

  // Superuser-only, matching every other collection after
  // 1783200000_lock_collection_rules.js. The Express server authenticates as a
  // superuser and bypasses these rules; no one else may reach the data layer.
  collection.listRule = null
  collection.viewRule = null
  collection.createRule = null
  collection.updateRule = null
  collection.deleteRule = null
  app.save(collection)
}, (app) => {
  deleteCollectionIfExists(app, "user_appearance")
})

function upsertCollection(app, collection) {
  try {
    const existing = app.findCollectionByNameOrId(collection.name)
    collection.id = existing.id
  } catch {}

  app.save(collection)
  return app.findCollectionByNameOrId(collection.name)
}

function deleteCollectionIfExists(app, name) {
  try {
    const collection = app.findCollectionByNameOrId(name)
    app.delete(collection)
  } catch {}
}
