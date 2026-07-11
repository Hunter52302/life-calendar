/// <reference path="../pb_data/types.d.ts" />
// Repair pass for user_appearance, mirroring this project's create/repair split
// (see 1782877600_support_collections_bridge.js): the create migration
// (1783500000) registers the collection, and fields are *guaranteed* here by
// adding them to the existing collection — the `new Collection({ fields })`
// constructor does not reliably persist them in this PocketBase build.
// Idempotent: if the fields already exist this is a no-op. Rules stay
// superuser-only (null), matching 1783200000_lock_collection_rules.js.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const collection = app.findCollectionByNameOrId("user_appearance")

  if (!collection.fields.getByName("user")) {
    collection.fields.addAt(1, new RelationField({
      name: "user",
      collectionId: users.id,
      required: true,
      minSelect: 1,
      maxSelect: 1,
      cascadeDelete: true,
    }))
  }

  if (!collection.fields.getByName("data")) {
    collection.fields.add(new JSONField({ name: "data", maxSize: 8388608 }))
  }

  collection.listRule = null
  collection.viewRule = null
  collection.createRule = null
  collection.updateRule = null
  collection.deleteRule = null
  app.save(collection)
}, (app) => {
  // Down: drop the added fields but keep the (empty) collection for the create
  // migration's own down step to remove.
  try {
    const collection = app.findCollectionByNameOrId("user_appearance")
    collection.fields.removeByName("data")
    collection.fields.removeByName("user")
    app.save(collection)
  } catch (_) { /* collection may not exist */ }
})
