"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, Rows3 } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Density Toggle ───────────────────────────────────────────────────────────
//
// Two layout modes for the active-game floor:
//
//   • comfort — current 2-6 column card grid with full info per child
//   • dense   — high-density rows; 20-30 kids visible at once on a tablet
//
// Selection persists in localStorage so each operator picks once.

export type Density = "comfort" | "dense"

const KEY = "gkp:aktif-oyun:density"

export function useDensity(): [Density, (next: Density) => void] {
  const [density, setDensityState] = useState<Density>("comfort")

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const saved = window.localStorage.getItem(KEY) as Density | null
      if (saved === "comfort" || saved === "dense") setDensityState(saved)
    } catch { /* swallow */ }
  }, [])

  const setDensity = (next: Density) => {
    setDensityState(next)
    try { window.localStorage.setItem(KEY, next) } catch { /* swallow */ }
  }

  return [density, setDensity]
}

export function DensityToggle({ value, onChange }: { value: Density; onChange: (next: Density) => void }) {
  return (
    <div
      role="group"
      aria-label="Görünüm yoğunluğu"
      className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5"
    >
      <button
        type="button"
        aria-pressed={value === "comfort"}
        title="Konforlu görünüm"
        onClick={() => onChange("comfort")}
        className={cn(
          "px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors",
          value === "comfort"
            ? "bg-violet-500 text-white"
            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
        )}
      >
        <LayoutGrid className="w-3 h-3" />
        Konforlu
      </button>
      <button
        type="button"
        aria-pressed={value === "dense"}
        title="Yoğun görünüm — 20+ çocuk bir ekranda"
        onClick={() => onChange("dense")}
        className={cn(
          "px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors",
          value === "dense"
            ? "bg-violet-500 text-white"
            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
        )}
      >
        <Rows3 className="w-3 h-3" />
        Yoğun
      </button>
    </div>
  )
}
