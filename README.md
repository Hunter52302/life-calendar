# PLS Calendar

PLS Calendar is a local-first life calendar application built with React, Vite, and Tauri.

## Download

Desktop builds are published through GitHub Releases.

1. Open the latest release.
2. Download the installer for your system.
3. Install and run the app.

## Release assets

| Platform | Asset |
| --- | --- |
| Windows | `PLS-Calendar-vX.X.X-setup.exe` |
| Windows | `PLS-Calendar-vX.X.X.msi` |
| macOS | `PLS-Calendar-vX.X.X-macos-ARCH.dmg` |

## macOS unsigned build note

The macOS `.dmg` build is distributed through GitHub Releases. It is not a Mac App Store build.

If the app is unsigned or not notarized, macOS may block it on first launch.

To open it:

1. Try to open PLS Calendar once.
2. Open **System Settings**.
3. Go to **Privacy & Security**.
4. Click **Open Anyway** for PLS Calendar.
5. Confirm **Open**.

A paid Apple Developer account is only needed later for Developer ID signing, notarization, or Mac App Store distribution.

## Development

```bash
npm ci
npm run dev
```

## Desktop build

```bash
npm run tauri:build
```

## Release build

GitHub Actions builds release assets from `.github/workflows/release.yml`.

Manual release flow:

1. Go to **Actions**.
2. Open **Build Desktop Release**.
3. Click **Run workflow**.
4. Enter a tag, such as `v1.0.12`.
5. Run the workflow.

The workflow uploads Windows and macOS assets to the matching GitHub Release.