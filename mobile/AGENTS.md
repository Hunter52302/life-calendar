# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Dev client required (since expo-share-intent)

This app uses `expo-share-intent` for OS-level share-to-app support, which
ships native code. Plain `expo start` + the Expo Go app **no longer works**
for this project — Expo Go can't load native modules that aren't already
built into it.

Instead:

```sh
npm run prebuild      # expo prebuild --no-install --clean (regenerate ios/ and android/)
npm run android       # expo run:android — builds + installs a dev client locally
npm run ios           # expo run:ios     — builds + installs a dev client locally
```

After the first native build, `npm start` (`expo start`) will connect to that
installed dev client instead of Expo Go. Re-run `prebuild` + `run:*` whenever
native dependencies or `app.json` plugin config change. For CI/cloud builds,
set up `eas.json` via `eas build:configure` instead of building locally.

## OTA updates (expo-updates / EAS Update)

JS-bundle updates ship via EAS Update, published automatically by
`.github/workflows/mobile-update.yml` on every `v*` tag push (publishes to the
`production` channel, which `eas.json`'s `production` build profile is bound
to). The in-app updater (`src/hooks/useAppUpdater.js`) checks on launch,
exposes a manual "Check for Updates" action and an auto-update toggle in
Settings, and an `UpdateBanner` for the manual case.

**Rollback is a maintainer action, not a user-facing button.** `expo-updates`'
client API (`checkForUpdateAsync` / `fetchUpdateAsync`) takes no parameters in
SDK 56 — there's no way for the client to target an arbitrary previous OTA
version or switch channels at runtime. The only rollback path is:

```sh
eas update:roll-back-to-embedded --channel production
```

run by a maintainer when a release needs to be undone. Every device picks
this up the same way it picks up a normal update — the client sees
`isRollBackToEmbedded: true` and reverts to the JS bundle embedded in the
installed binary (i.e., the last store/EAS build, not an arbitrary previous
OTA update).
