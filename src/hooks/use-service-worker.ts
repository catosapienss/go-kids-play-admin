"use client"

import { useEffect } from "react"
import { createLogger } from "@/lib/reliability/logger"

const log = createLogger("sw")

// ─── useServiceWorker ────────────────────────────────────────────────────────
//
// Registers a service worker once per browser session. Safe to call from
// any client component — it's a no-op in unsupported environments
// (server render, dev w/ HTTP, browsers without SW support).

export function useServiceWorker(scriptPath: string): void {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    // Avoid registering on `http://` other than localhost.
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      return
    }

    let cancelled = false
    void navigator.serviceWorker.register(scriptPath, { scope: "/" })
      .then((reg) => {
        if (cancelled) return
        log.info("service worker registered", { scope: reg.scope })
      })
      .catch((e) => {
        log.warn("service worker registration failed", undefined, e)
      })

    return () => { cancelled = true }
  }, [scriptPath])
}
