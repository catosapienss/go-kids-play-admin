"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  getActiveShift, startShift, endShift,
} from "@/lib/services/staff-shift.service"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { createLogger } from "@/lib/reliability/logger"
import type { Shift } from "@/types/staff-shift"

const log = createLogger("use-shift")

// ─── useShiftStatus ───────────────────────────────────────────────────────────
//
// Lightweight hook that any page can use to know "am I on the clock?".
//
//   • Live `elapsedSeconds` ticker (1s)
//   • Optimistic start/end actions
//   • Re-syncs on reconnect (network drop won't lose shift state)

export interface ShiftStatus {
  shift: Shift | null
  isActive: boolean
  elapsedSeconds: number
  isLoading: boolean
  start: () => Promise<void>
  end: () => Promise<void>
  /** Force a fresh fetch from the server. */
  refresh: () => Promise<void>
}

export function useShiftStatus(): ShiftStatus {
  const [shift, setShift] = useState<Shift | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const reconnectToken = useReconnectToken()
  const startedAtRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const s = await getActiveShift()
      setShift(s)
      startedAtRef.current = s ? new Date(s.startedAt).getTime() : null
    } catch (e) {
      log.warn("getActiveShift failed", undefined, e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh, reconnectToken])

  // 1s ticker drives the elapsed display.
  useEffect(() => {
    if (!shift) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [shift])

  const elapsedSeconds = startedAtRef.current
    ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
    : 0
  // Reference tick so React re-renders every second.
  void tick

  const start = useCallback(async () => {
    setLoading(true)
    try {
      const s = await startShift()
      setShift(s)
      startedAtRef.current = new Date(s.startedAt).getTime()
    } finally {
      setLoading(false)
    }
  }, [])

  const end = useCallback(async () => {
    setLoading(true)
    try {
      await endShift()
      setShift(null)
      startedAtRef.current = null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    shift,
    isActive: !!shift,
    elapsedSeconds,
    isLoading,
    start,
    end,
    refresh,
  }
}
