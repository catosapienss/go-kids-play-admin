"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import {
  resolvePreset,
  type DateRange, type RangePreset,
} from "@/types/reports"

// ─── DateRange Context ───────────────────────────────────────────────────────
//
// One source of truth for the date filter on /raporlar. Every panel reads
// `range` from this context so a single picker drives the whole dashboard.

interface DateRangeValue {
  preset: RangePreset
  range:  DateRange
  setPreset: (p: RangePreset) => void
  setCustom: (custom: DateRange) => void
}

const DateRangeContext = createContext<DateRangeValue | null>(null)

export function DateRangeProvider({
  initialPreset = "last7",
  children,
}: { initialPreset?: RangePreset; children: React.ReactNode }) {
  const [preset, setPresetState] = useState<RangePreset>(initialPreset)
  const [custom, setCustomState] = useState<DateRange | null>(null)

  const range = useMemo(
    () => resolvePreset(preset, custom ?? undefined),
    [preset, custom],
  )

  const setPreset = useCallback((p: RangePreset) => {
    setPresetState(p)
    if (p !== "custom") setCustomState(null)
  }, [])

  const setCustom = useCallback((r: DateRange) => {
    setCustomState(r)
    setPresetState("custom")
  }, [])

  const value = useMemo<DateRangeValue>(() => ({
    preset, range, setPreset, setCustom,
  }), [preset, range, setPreset, setCustom])

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange(): DateRangeValue {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error("useDateRange must be used inside <DateRangeProvider>")
  return ctx
}
