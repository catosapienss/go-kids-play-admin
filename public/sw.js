// ─── Go Kids Play — Admin Service Worker ─────────────────────────────────────
//
// Enables PWA installability on Windows/Mac Chrome desktops.
// Caches only static brand shell assets — all Supabase/API calls stay
// network-first so live data (sessions, payments) is never stale.

const CACHE = "gkp-admin-shell-v2"
const SHELL = [
  "/brand/logo.png",
  "/brand/logo-mark.png",
  "/brand/favicon.png",
  "/brand/apple-touch-icon.png",
  "/manifest.webmanifest",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => undefined),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)

  // Skip everything except same-origin asset traffic. In particular:
  //   • Cross-origin (Supabase realtime + REST) → bypass entirely.
  //   • Same-origin /api/* / RPCs → bypass (never cache live data).
  //   • Anything that looks like a page (not under /brand or /manifest) → bypass.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return
  if (!url.pathname.startsWith("/brand/") && url.pathname !== "/manifest.webmanifest") return

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        // Cache successful responses for the brand shell.
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined)
        }
        return res
      }).catch(() => cached)
    }),
  )
})
