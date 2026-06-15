"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useNetworkStatus } from "./network-status"
import { createLogger } from "./logger"

const log = createLogger("rt-supervisor")

// ─── Realtime Supervisor ──────────────────────────────────────────────────────
//
// Provides app-wide signals that other realtime consumers (session store,
// alert engine, analytics hooks) react to:
//
//   • `reconnectToken` — increments after a successful realtime re-connect,
//     after a tab-focus event that may have stale state, and after coming
//     back online. Consumers `useEffect(() => refetch(), [reconnectToken])`
//     so their data is guaranteed not to drift.
//
//   • `requestResync()` — manual trigger (e.g. user clicked "Refresh").

interface SupervisorValue {
  reconnectToken: number
  /** Last time we observed a fresh subscription. */
  lastReconnectAt: number | null
  /** Force a global resync. */
  requestResync: () => void
}

const SupervisorContext = createContext<SupervisorValue | null>(null)

// Heuristic: if the tab was hidden longer than this, treat the state as stale
// when the user comes back.
const STALE_AFTER_HIDDEN_MS = 30_000

export function RealtimeSupervisor({ children }: { children: React.ReactNode }) {
  const { online, realtimeConnected } = useNetworkStatus()
  const [reconnectToken, setReconnectToken] = useState(0)
  const [lastReconnectAt, setLastReconnectAt] = useState<number | null>(null)

  const wasConnectedRef = useRef(realtimeConnected)
  const hiddenSinceRef  = useRef<number | null>(null)

  const bumpToken = useCallback((reason: string) => {
    log.info("resync requested", { reason })
    setReconnectToken((t) => t + 1)
    setLastReconnectAt(Date.now())
  }, [])

  const requestResync = useCallback(() => bumpToken("manual"), [bumpToken])

  // ── React to realtime channel coming back online ──────────────────────────
  useEffect(() => {
    if (!wasConnectedRef.current && realtimeConnected) {
      bumpToken("realtime-reconnect")
    }
    wasConnectedRef.current = realtimeConnected
  }, [realtimeConnected, bumpToken])

  // ── React to navigator.onLine ──────────────────────────────────────────────
  useEffect(() => {
    function onOnline() {
      bumpToken("browser-online")
      // Force the realtime client to re-handshake — its internal reconnect can
      // be sluggish after long offline periods.
      try { createClient().realtime.connect() } catch { /* swallow */ }
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [bumpToken])

  // ── React to tab visibility — long-hidden tabs likely have stale state ────
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenSinceRef.current = Date.now()
        return
      }
      // We're now visible.
      const hiddenSince = hiddenSinceRef.current
      hiddenSinceRef.current = null
      if (!hiddenSince) return
      const elapsed = Date.now() - hiddenSince
      if (elapsed > STALE_AFTER_HIDDEN_MS) {
        bumpToken(`tab-focus-after-${Math.round(elapsed / 1000)}s`)
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [bumpToken])

  // ── Pure online → bump too (only if we were offline before) ───────────────
  const wasOnlineRef = useRef(online)
  useEffect(() => {
    if (!wasOnlineRef.current && online) {
      bumpToken("online-after-offline")
    }
    wasOnlineRef.current = online
  }, [online, bumpToken])

  const value = useMemo<SupervisorValue>(() => ({
    reconnectToken,
    lastReconnectAt,
    requestResync,
  }), [reconnectToken, lastReconnectAt, requestResync])

  return (
    <SupervisorContext.Provider value={value}>
      {children}
    </SupervisorContext.Provider>
  )
}

export function useRealtimeSupervisor(): SupervisorValue {
  const ctx = useContext(SupervisorContext)
  // Safe default — features that don't require resync still work.
  return ctx ?? { reconnectToken: 0, lastReconnectAt: null, requestResync: () => undefined }
}

/** Convenience hook for consumers that just want the token. */
export function useReconnectToken(): number {
  return useRealtimeSupervisor().reconnectToken
}
