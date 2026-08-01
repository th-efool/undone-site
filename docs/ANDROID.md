# SideQuestHQ Android (Capacitor)

This repo ships the existing Next.js web app inside a Capacitor Android shell. The UI is not rewritten: mobile builds statically export the App Router pages into `out/`, then Capacitor bundles those assets into the native project.

## Architecture

- **Web content**: static export from the current Next.js app (`MOBILE_BUILD=true`).
- **API routes**: not bundled. Client fetches use `NEXT_PUBLIC_API_ORIGIN` (default `https://sidequesthq.com`).
- **Package name**: `com.yourcompany.sidequesthq`
- **Deep links**: `https://sidequesthq.com/*` and `sidequesthq://*`

## Prerequisites

- Node.js 18+
- Android Studio with Android SDK (API 35 recommended)
- JDK 17+
- Environment variables from [`.env.mobile.example`](./.env.mobile.example)

## Install

```bash
npm install
```

Capacitor and the Android platform are added automatically on first mobile build/sync.

## Development

### Bundled static app (production-like)

```bash
npm run mobile:build
npm run mobile:open
```

Run from Android Studio on a device/emulator.

### Live reload against `next dev`

```bash
npm run dev
# In another terminal (emulator example):
set CAPACITOR_DEV_SERVER_URL=http://10.0.2.2:3000
npx cap sync android
npm run mobile:open
```

## Release AAB (Google Play)

1. Set signing env vars (see `.env.mobile.example`):

   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
   - Optional: `ANDROID_KEYSTORE_PATH` (defaults to `@agrim00001__sidequesthq.jks` in repo root)

2. Build:

```bash
npm run mobile:release:aab
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

## Native features configured

| Feature | Implementation |
|--------|----------------|
| Adaptive icon | `@mipmap` + vector foreground (`#4F46E5` on cream background) |
| Splash screen | Capacitor SplashScreen plugin + Android 12 splash drawable |
| Edge-to-edge | `MainActivity` WindowInsets + `WindowCompat.setDecorFitsSystemWindows(false)` |
| Back button | `@capacitor/app` listener in `CapacitorBridge` |
| Deep links | Intent filters in `AndroidManifest.xml` |
| Internet | `INTERNET` permission in manifest |

## Maintenance notes

- Web changes: edit the Next.js app as usual, then `npm run mobile:build`.
- New dynamic cohort routes are pre-rendered from `cohortCatalog`; add IDs there or extend `getCohortStaticParams`.
- Do not commit `.jks` files or `android/keystore.properties`.
