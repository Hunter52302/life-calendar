# Life Calendar

Desktop builds ship through GitHub Releases.

## Download

Open [Releases](https://github.com/Hunter52302/life-calendar/releases/latest), then download file for your OS.

Windows:

- `PLS-Calendar-vX.X.X-setup.exe`
- `PLS-Calendar-vX.X.X.msi`

macOS:

- `PLS-Calendar-vX.X.X-macos-arm64.dmg` for Apple Silicon Macs.
- `PLS-Calendar-vX.X.X-macos-x64.dmg` for Intel Macs.

## macOS unsigned app warning

macOS builds use unsigned `.dmg` files. No paid Apple Developer account is required for this release path.

First launch may require:

1. Open downloaded `.dmg`.
2. Drag PLS Calendar into Applications.
3. Try opening PLS Calendar.
4. If macOS blocks it, open System Settings -> Privacy & Security.
5. Click Open Anyway for PLS Calendar.

Apple Developer account is only needed later for code signing, notarization, or Mac App Store release.

## Build Release

Manual release:

1. Open GitHub -> Actions -> Build Desktop Release.
2. Click Run workflow.
3. Enter tag, for example `v1.0.12`.

Tag release:

```sh
git tag v1.0.12
git push origin v1.0.12
```

After workflow finishes, release assets should include:

- `PLS-Calendar-v1.0.12-setup.exe`
- `PLS-Calendar-v1.0.12.msi`
- `PLS-Calendar-v1.0.12-macos-arm64.dmg`
- `PLS-Calendar-v1.0.12-macos-x64.dmg`

## Self-hosting

PLS Calendar can run entirely on your own infrastructure — from account-free
local-only use (no server at all) to a full self-hosted sync backend. See the
[self-hosting guide](docs/SELF_HOSTING.md) for the breakdown of options and the
required configuration.

## Development

```sh
npm ci
npm run dev
```

Desktop build:

```sh
npm run tauri:build
```
