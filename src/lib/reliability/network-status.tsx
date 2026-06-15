"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { createLogger } from "./logger"

const log = createLogger("network")

// ─── Network Status Provider ─────────────────────────────────────────────────
//
// Two signals are tracked separately:
//
//   • `online`           — navigator.onLine (browser-reported connectivity)
//   • `realtimeConnected` — Supabase realtime channel state
//
// Both expose `since` so UI can show "1 saniye önce offline oldu" etc.

export interface NetworkStatus {
  online: boolean
  realtimeConnected: boolean
  onlineSince: number | null
  offlineSince: number | null
  realtimeDownSince: number | null
}

const NetworkStatusContext = createContext<NetworkStatus | null>(null)

// ─── Heartbeat — periodically test Supabase to detect dead pipes ──────────────

const HEARTBEAT_INTERVAL_MS = 30_000   // light ping every 30s

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true)
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(true)
  const [onlineSince,       setOnlineSince]       = useState<number | null>(Date.now())
  const [offlineSince,      setOfflineSince]      = useState<number | null>(null)
  const [realtimeDownSince, setRealtimeDownSince] = useState<number | null>(null)

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)

  // ── Browser online / offline events ─────────────────────────────────────────
  useEffect(() => {
    function handleOnline() {
      log.info("browser online")
      setOnline(true)
      setOnlineSince(Date.now())
      setOfflineSince(null)
    }
    function handleOffline() {
      log.warn("browser offline")
      setOnline(false)
      setOfflineSince(Date.now())
      setOnlineSince(null)
    }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // ── Realtime presence channel — tells us when the websocket is alive ───────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel("__network_heartbeat__")
    channelRef.current = channel

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        log.info("realtime connected")
        setRealtimeConnected(true)
        setRealtimeDownSince(null)
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        log.warn("realtime down", { status })
        setRealtimeConnected(false)
        setRealtimeDownSince((prev) => prev ?? Date.now())
      }
    })

    return () => { void supabase.removeChannel(channel) }
  }, [])

  // ── Heartbeat: probe Supabase HTTP every 30s when we *think* we're online ──
  useEffect(() => {
    let cancelled = false
    async function tick() {
      if (cancelled) return
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      try {
        // Cheapest signed-in call: get session (no network if cached, but in
        // practice still validates the auth pipe).
        const supabase = createClient()
        const ctrl = new AbortController()
        const timeout = setTimeout(() => ctrl.abort(), 8000)
        await supabase.auth.getSession()
        clearTimeout(timeout)
      } catch (e) {
        log.warn("heartbeat failed", undefined, e)
        // Don't flip `online` based on heartbeat alone — browser already does that.
      }
    }
    const id = setInterval(tick, HEARTBEAT_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const value = useMemo<NetworkStatus>(() => ({
    online,
    realtimeConnected,
    onlineSince,
    offlineSince,
    realtimeDownSince,
  }), [online, realtimeConnected, onlineSince, offlineSince, realtimeDownSince])

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  )
}

export function useNetworkStatus(): NetworkStatus {
  const ctx = useContext(NetworkStatusContext)
  // Fall back to safe defaults if the provider isn't mounted yet.
  return ctx ?? {
    online: true,
    realtimeConnected: true,
    onlineSince: null,
    offlineSince: null,
    realtimeDownSince: null,
  }
}
