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
