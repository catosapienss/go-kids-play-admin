"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { createClient } from "@/lib/supabase/client"
import {
  fetchActiveSessions,
  dbRowToActiveSession,
  extendSession as svcExtend,
  pauseSession as svcPause,
  resumeSession as svcResume,
  endSession as svcEnd,
} from "@/lib/services/session.service"
import type { DbSessionRow } from "@/types/realtime"
import type { ActiveSession, LiveEvent } from "@/types/aktif-oyun"
import { toast } from "sonner"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { createLogger } from "@/lib/reliability/logger"

const slog = createLogger("session-store")

// ─── Context ──────────────────────────────────────────────────────────────────

interface SessionStoreValue {
  sessions: ActiveSession[]
  events: LiveEvent[]
  isLoading: boolean
  extend: (id: string, minutes: number) => Promise<void>
  extendEndTime: (id: string, minutes: number) => void
  pause: (id: string) => Promise<void>
  resume: (id: string) => Promise<void>
  exit: (id: string) => Promise<void>
  /** Force-refetch from Supabase. Called by /hizli-kayit after submit so the
   *  new session shows up even if realtime publication is misconfigured. */
  refresh: () => Promise<void>
}

const SessionStoreContext = createContext<SessionStoreValue | null>(null)

let _eventId = 0
function makeEventId() { return `ev_${++_eventId}` }

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SessionStoreProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [events, setEvents]     = useState<LiveEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Synchronous mirror of sessions state (avoids stale closures in ticker)
  const sessionsRef = useRef<ActiveSession[]>([])

  // Maps session id → end timestamp ms (null = free play/no timer, absent = paused)
  const endTimesRef = useRef<Record<string, number | null>>({})

  // ── Sync helpers ──────────────────────────────────────────────────────────

  function setAndSync(next: ActiveSession[]) {
    sessionsRef.current = next
    setSessions(next)
  }

  function addEvent(ev: LiveEvent) {
    setEvents((prev) => [ev, ...prev].slice(0, 50))
  }

  function trackEndTime(row: Pick<DbSessionRow, "id" | "status" | "end_time" | "duration_minutes">) {
    if (row.status === "paused" || row.duration_minutes === 0) {
      delete endTimesRef.current[row.id]
    } else if (row.end_time) {
      endTimesRef.current[row.id] = new Date(row.end_time).getTime()
    }
  }

  // ── Initial load + automatic re-sync on reconnect ─────────────────────────
  //
  // The realtime supervisor bumps `reconnectToken` after any of:
  //   • Supabase realtime channel re-connecting
  //   • navigator.onLine flipping back to true
  //   • tab returning from being hidden for > 30s
  //
  // Refetching here prevents the "ghost session" bug where the store missed
  // an INSERT/DELETE while offline and now shows phantom rows.

  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    if (reconnectToken > 0) slog.info("resync after reconnect", { token: reconnectToken })
    setIsLoading(true)
    fetchActiveSessions()
      .then((data) => {
        if (cancelled) return
        setAndSync(data)
        // Rebuild endTimes from fresh data — eliminates clock drift after sleep.
        endTimesRef.current = {}
        data.forEach((s) => {
          if (s.isPaused || s.packageType === "Serbest") {
            delete endTimesRef.current[s.id]
          } else {
            endTimesRef.current[s.id] = Date.now() + s.remainingSeconds * 1000
          }
        })
      })
      .catch((e) => {
        slog.error("session resync failed", undefined, e)
        toast.error("Oturumlar yüklenemedi")
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [reconnectToken])

  // ── Supabase Realtime ─────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("sessions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        (payload) => {
          const eventType = payload.eventType

          // ── INSERT ──────────────────────────────────────────────────────
          if (eventType === "INSERT") {
            const row = payload.new as DbSessionRow
            if (row.status === "completed") return

            const session = dbRowToActiveSession(row)
            setAndSync([session, ...sessionsRef.current])
            trackEndTime(row)

            addEvent({
              id: makeEventId(),
              type: "entry",
              childName: row.child_name,
              parentName: row.parent_name,
              staffName: row.staff_name,
              timestamp: new Date(),
              detail: row.duration_minutes === 0 ? "Serbest süre başladı" : `${row.duration_minutes} dk başladı`,
            })
            toast.success(`${row.child_name} oyun alanına girdi`)
          }

          // ── UPDATE ──────────────────────────────────────────────────────
          if (eventType === "UPDATE") {
            const row = payload.new as DbSessionRow

            // Capture pre-mutation state BEFORE any ref updates
            const prevSession = sessionsRef.current.find((s) => s.id === row.id)
            const prevEndTs   = endTimesRef.current[row.id] ?? null

            if (row.status === "completed") {
              setAndSync(sessionsRef.current.filter((s) => s.id !== row.id))
              delete endTimesRef.current[row.id]
              return
            }

            const updatedSession = dbRowToActiveSession(row)
            setAndSync(sessionsRef.current.map((s) => s.id === row.id ? updatedSession : s))
            trackEndTime(row)

            // Determine which event to emit
            if (!prevSession) return

            if (!prevSession.isPaused && updatedSession.isPaused) {
              addEvent({
                id: makeEventId(), type: "pause",
                childName: row.child_name, parentName: row.parent_name, staffName: row.staff_name,
                timestamp: new Date(),
              })
            } else if (prevSession.isPaused && !updatedSession.isPaused) {
              addEvent({
                id: makeEventId(), type: "resume",
                childName: row.child_name, parentName: row.parent_name, staffName: row.staff_name,
                timestamp: new Date(),
              })
            } else if (row.end_time) {
              const newEndTs = new Date(row.end_time).getTime()
              if (prevEndTs !== null && newEndTs > prevEndTs + 5000) {
                // end_time jumped forward → extension
                const addedMins = Math.round((newEndTs - prevEndTs) / 60000)
                addEvent({
                  id: makeEventId(), type: "extend",
                  childName: row.child_name, parentName: row.parent_name, staffName: row.staff_name,
                  timestamp: new Date(),
                  detail: `+${addedMins} dk eklendi`,
                })
              }
            }
          }

          // ── DELETE ──────────────────────────────────────────────────────
          if (eventType === "DELETE") {
            const row = payload.old as DbSessionRow
            setAndSync(sessionsRef.current.filter((s) => s.id !== row.id))
            delete endTimesRef.current[row.id]
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Countdown engine — 1 s tick ────────────────────────────────────────

  useEffect(() => {
    const timerId = setInterval(() => {
      const now = Date.now()
      const current = sessionsRef.current
      let changed = false
      const expiredEvents: LiveEvent[] = []

      const next = current.map((s) => {
        // Skip paused and free-play sessions
        if (s.isPaused || s.packageType === "Serbest") return s

        const endTs = endTimesRef.current[s.id]
        if (endTs == null) return s

        const newRemaining = Math.max(0, Math.floor((endTs - now) / 1000))
        if (newRemaining === s.remainingSeconds) return s

        changed = true

        // Detect the moment a session expires
        if (newRemaining === 0 && s.remainingSeconds > 0) {
          expiredEvents.push({
            id: makeEventId(), type: "expire",
            childName: s.childName, parentName: s.parentName, staffName: s.staffName,
            timestamp: new Date(), detail: "Süre doldu",
          })
          toast.warning(`⚠️ ${s.childName} — süre doldu!`, { duration: 10000 })
        }

        return { ...s, remainingSeconds: newRemaining }
      })

      if (changed) {
        sessionsRef.current = next
        setSessions(next)
      }
      if (expiredEvents.length > 0) {
        setEvents((prev) => [...expiredEvents, ...prev].slice(0, 50))
      }
    }, 1000)

    return () => clearInterval(timerId)
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────

  const extend = useCallback(async (id: string, minutes: number) => {
    try {
      await svcExtend(id, minutes)
    } catch (err) {
      toast.error("Süre uzatılamadı: " + (err instanceof Error ? err.message : ""))
    }
  }, [])

  // Immediately bump the local countdown without waiting for a Realtime event.
  // Call this after any successful extension RPC (finance or plain) to keep the
  // UI timer in sync even if the Realtime UPDATE arrives late or is dropped.
  const extendEndTime = useCallback((id: string, minutes: number) => {
    const cur = endTimesRef.current[id]
    if (cur !== undefined && cur !== null) {
      endTimesRef.current[id] = cur + minutes * 60 * 1000
    }
  }, [])

  const pause = useCallback(async (id: string) => {
    const s = sessionsRef.current.find((x) => x.id === id)
    if (!s) return
    try {
      await svcPause(id, s.remainingSeconds)
    } catch (err) {
      toast.error("Duraklatılamadı: " + (err instanceof Error ? err.message : ""))
    }
  }, [])

  const resume = useCallback(async (id: string) => {
    try {
      await svcResume(id)
    } catch (err) {
      toast.error("Devam ettirilemedi: " + (err instanceof Error ? err.message : ""))
    }
  }, [])

  // Defensive refetch — used by /hizli-kayit after a successful registration
  // so the new row appears in /aktif-oyun even if the realtime channel did
  // not deliver the INSERT (e.g. publication not configured for the table).
  const refresh = useCallback(async () => {
    try {
      const data = await fetchActiveSessions()
      setAndSync(data)
      endTimesRef.current = {}
      data.forEach((s) => {
        if (s.isPaused || s.packageType === "Serbest") {
          delete endTimesRef.current[s.id]
        } else {
          endTimesRef.current[s.id] = Date.now() + s.remainingSeconds * 1000
        }
      })
    } catch (err) {
      slog.error("session refresh failed", undefined, err)
    }
  }, [])

  const exit = useCallback(async (id: string) => {
    const s = sessionsRef.current.find((x) => x.id === id)
    try {
      await svcEnd(id)
      if (s) {
        addEvent({
          id: makeEventId(), type: "exit",
          childName: s.childName, parentName: s.parentName, staffName: s.staffName,
          timestamp: new Date(), detail: "Normal çıkış",
        })
      }
    } catch (err) {
      toast.error("Çıkış yapılamadı: " + (err instanceof Error ? err.message : ""))
    }
  }, [])

  return (
    <SessionStoreContext.Provider value={{ sessions, events, isLoading, extend, extendEndTime, pause, resume, exit, refresh }}>
      {children}
    </SessionStoreContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSessionStore() {
  const ctx = useContext(SessionStoreContext)
  if (!ctx) throw new Error("useSessionStore must be inside <SessionStoreProvider>")
  return ctx
}
