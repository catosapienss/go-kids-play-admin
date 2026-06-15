// ─── Go Kids Play — Electron main process ────────────────────────────────────
//
// Wraps the Next.js production server in a desktop window so the platform
// installs as "Go Kids Play" instead of opening as a browser tab.
//
// Two modes (controlled by GKP_MODE env):
//   • dev  → load http://localhost:3003 (you ran `npm run dev` in another shell)
//   • prod → start an embedded Next.js server on a free port, load that URL
//
// Run with:
//   GKP_MODE=dev  npm run electron        (development against running dev server)
//   GKP_MODE=prod npm run electron        (packaged-equivalent local run)

const path = require("path")
const { app, BrowserWindow, Menu, shell, dialog } = require("electron")

const MODE = process.env.GKP_MODE || (app.isPackaged ? "prod" : "dev")
const DEV_URL = process.env.GKP_DEV_URL || "http://localhost:3003"
const PROD_PORT = Number(process.env.GKP_PROD_PORT) || 3100

let mainWindow = null
let nextServer = null

// ─── Embedded production server (only used when MODE === "prod") ─────────────

async function startNextProdServer() {
  // We require these lazily so dev mode doesn't pay the cost.
  const next = require("next")
  const http = require("http")

  // When the app is packaged, the Next.js .next folder sits next to main.js.
  // When running unpacked (npm run electron), it's at the project root.
  const dir = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.resolve(__dirname, "..")

  const nextApp = next({ dev: false, dir, hostname: "127.0.0.1", port: PROD_PORT })
  const handler = nextApp.getRequestHandler()
  await nextApp.prepare()

  return new Promise((resolve, reject) => {
    nextServer = http
      .createServer((req, res) => handler(req, res))
      .listen(PROD_PORT, "127.0.0.1", () => resolve(`http://127.0.0.1:${PROD_PORT}`))
      .on("error", reject)
  })
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow(loadUrl) {
  mainWindow = new BrowserWindow({
    title: "Go Kids Play",
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0f172a",
    show: false, // show only when ready-to-show so we never flash a white frame
    autoHideMenuBar: true,
    icon: getAppIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Strip browser-y feel: disallow opening dev tools by default in prod
      devTools: MODE === "dev",
    },
  })

  // Replace the default app menu with a minimal one — kasiyer doesn't need
  // View / Window / Help / etc. (Cmd+Q still works.)
  const isMac = process.platform === "darwin"
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac
        ? [{ label: "Go Kids Play", submenu: [
            { role: "about", label: "Go Kids Play hakkında" },
            { type: "separator" },
            { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
            { type: "separator" },
            { role: "quit", label: "Çıkış" },
          ] }]
        : []),
      { label: "Düzenle", submenu: [
        { role: "copy", label: "Kopyala" },
        { role: "paste", label: "Yapıştır" },
        { role: "selectAll", label: "Tümünü Seç" },
      ] },
      { label: "Görünüm", submenu: [
        { role: "reload", label: "Yenile" },
        { role: "togglefullscreen", label: "Tam Ekran" },
        { role: "zoomIn",  label: "Yakınlaştır" },
        { role: "zoomOut", label: "Uzaklaştır" },
        { role: "resetZoom", label: "Sıfırla" },
      ] },
    ]),
  )

  // External links open in the default browser, not inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => undefined)
    return { action: "deny" }
  })

  mainWindow.once("ready-to-show", () => mainWindow.show())
  mainWindow.on("closed", () => { mainWindow = null })

  mainWindow.loadURL(loadUrl).catch((err) => {
    dialog.showErrorBox(
      "Go Kids Play başlatılamadı",
      `Uygulama yüklenirken bir sorun oluştu:\n\n${err?.message ?? err}\n\n` +
      `Tekrar denemek için uygulamayı yeniden açın.`,
    )
  })
}

function getAppIconPath() {
  // The brand mark sits in public/brand/ — Electron will pick the right format
  // for the host OS. electron-builder packs the platform-specific icon.
  return path.resolve(__dirname, "../public/brand/favicon.png")
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.setName("Go Kids Play")

app.whenReady().then(async () => {
  try {
    const url = MODE === "dev"
      ? DEV_URL
      : await startNextProdServer()
    createWindow(url)
  } catch (err) {
    dialog.showErrorBox(
      "Sunucu başlatılamadı",
      String(err?.stack || err),
    )
    app.exit(1)
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
    // macOS: re-open window when dock icon clicked
    app.whenReady().then(() => createWindow(MODE === "dev" ? DEV_URL : `http://127.0.0.1:${PROD_PORT}`))
  }
})

app.on("window-all-closed", () => {
  // Standard non-mac behaviour: quit when window closes
  if (process.platform !== "darwin") app.quit()
})

app.on("before-quit", () => {
  try { nextServer?.close() } catch { /* swallow */ }
})
