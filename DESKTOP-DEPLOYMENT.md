# Go Kids Play — Desktop Deployment Guide

This guide walks you from "code on developer machine" to "installed application
on the business computer".

There are **two deployment modes** depending on how stable the business's
internet is and how the operator wants the app to feel.

| Mode | What runs locally | What needs internet | Look & feel |
| --- | --- | --- | --- |
| **A. PWA install** | Nothing (the web app caches itself) | Always (every Supabase call) | Chrome window styled as a standalone app — "Go Kids Play" appears in the Start Menu |
| **B. Electron desktop app** | Embedded Next.js server + Chromium | Only for Supabase data | True desktop application — installs from `Go Kids Play Setup.exe`, custom icon, no browser chrome |

Mode A is **5 minutes** to set up. Mode B is the production answer; takes
~30 minutes the first time you build it.

---

## Mode A — Install as PWA from Chrome (fastest)

The PWA is already complete. On the business computer:

1. Open Chrome, navigate to your deployed Go Kids Play URL.
2. Sign in once so the cache picks up the brand assets.
3. Click the **install icon** in the address bar (small monitor with a down-arrow).
   - Alternatively: menu (`⋮`) → **Save and share** → **Install Go Kids Play…**
4. Pick "Install".
5. Go Kids Play now appears in the Start Menu and on the desktop, opens in its
   own window without the address bar, and shows the giraffe icon.

To uninstall: right-click the desktop icon → "Uninstall Go Kids Play".

---

## Mode B — Build a true Windows installer with Electron

The repository now ships with:

- `electron/main.js` — Electron main process
- Build config inside `package.json` under `"build"` for `electron-builder`
- `build/icon.png` — fallback icon (provide `icon.ico` for native Windows quality)

### 1. Install dependencies

```bash
npm install
```

This pulls in `electron` and `electron-builder` (already declared in
`devDependencies`).

### 2. Run desktop in dev (sanity check)

In one terminal:
```bash
npm run dev
```

In another:
```bash
npm run electron
```

A native window labelled **Go Kids Play** should open and load
`http://localhost:3003`. This is your developer loop — no installer yet.

### 3. Build the Next.js production bundle

```bash
npm run build
```

This populates `.next/standalone` (because `next.config.mjs` has
`output: "standalone"`).

### 4. Smoke-test the packaged app locally (no installer yet)

```bash
npm run desktop:pack
```

This creates an unpacked app in `dist-desktop/mac/` (or `dist-desktop/win-unpacked/`
on Windows). Double-click the `Go Kids Play` executable inside to verify the
launcher works.

### 5. Generate the platform installer

| Target OS | Command | Output |
| --- | --- | --- |
| Windows  | `npm run desktop:dist:win`   | `dist-desktop/Go Kids Play Setup *.exe` (NSIS installer) |
| macOS    | `npm run desktop:dist:mac`   | `dist-desktop/Go Kids Play-*.dmg` |
| Linux    | `npm run desktop:dist:linux` | `dist-desktop/Go Kids Play-*.AppImage` |

The Windows build can be produced on a Mac with no extra setup. (Code-signing
requires a Windows cert — not strictly needed for in-house deployment; users
will see a SmartScreen warning the first time and can click "Run anyway".)

### 6. Install on the business computer

1. Copy `Go Kids Play Setup.exe` to the business machine (USB stick, OneDrive,
   email — anywhere).
2. Double-click. NSIS installer launches:
   - Choose install location (default: `C:\Program Files\Go Kids Play`)
   - "Create desktop shortcut" — ✓
   - "Create Start Menu shortcut" — ✓
3. Installer finishes → "Run Go Kids Play" → window opens immediately.
4. Sign in once. localStorage persists, so subsequent launches go straight to
   the dashboard.

### 7. Where data lives after install

| Where | Lives |
| --- | --- |
| Cached brand assets (logo, favicon) | `%APPDATA%\Go Kids Play\Cache` |
| Sign-in session, settings, demo flag | `%APPDATA%\Go Kids Play\Local Storage` |
| Operator settings (paket fiyatları vb.) | localStorage (browser-managed) |
| All operational data (sessions, payments, etc.) | Supabase project |

Nothing financial sits in localStorage. Reset is safe: uninstall + reinstall
loses only UI preferences.

---

## Generating the Windows `.ico` (one-time, on the Mac)

For a polished installer icon, generate a real `.ico` once:

```bash
brew install imagemagick
cd build
magick icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

Re-run `npm run desktop:dist:win` — the installer + executable + Start Menu
shortcut now use the giraffe at every Windows icon size.

---

## Local test URL (before packaging)

The application is currently running for live verification at:

**Browser**: <http://localhost:3003>
**Login**: <http://localhost:3003/login>
**Role debug**: <http://localhost:3003/yetki>

Once you sign in, the manager sidebar should be fully populated. From there,
all operational flows behave identically inside Electron — packaging just adds
a window frame, an installer, and a desktop shortcut.

---

## Recommended deployment path for tomorrow

If you want the business computer ready **today** with the minimum risk:

1. **Use Mode A (PWA)** — 5-minute install, zero packaging risk.
2. Deploy the Next.js app once (Vercel free tier, or any host).
3. From the business computer, open Chrome, install as PWA.
4. **Build the Electron installer in parallel** (Mode B) to ship next week
   so the business can run the app fully offline-tolerant.

For full offline + native feel, Mode B is the destination. Mode A is the
shortcut that gets the app on the operator's desktop today.
