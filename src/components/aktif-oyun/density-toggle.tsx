"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, Rows3, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Density Toggle ───────────────────────────────────────────────────────────
//
// Three layout modes for the active-game floor:
//
//   • comfort — 2-6 column card grid with full info per child
//   • dense   — high-density rows; 20-30 kids visible on a tablet
//   • table   — operational data table; every column visible, single-row actions
//
// Selection persists in localStorage so each operator picks once.

export type Density = "comfort" | "dense" | "table"

const KEY = "gkp:aktif-oyun:density"

export function useDensity(): [Density, (next: Density) => void] {
  const [density, setDensityState] = useState<Density>("table")

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const saved = window.localStorage.getItem(KEY) as Density | null
      if (saved === "comfort" || saved === "dense" || saved === "table") setDensityState(saved)
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
      <Btn
        active={value === "table"}
        title="Tablo görünümü — çocuk, veli, telefon, fiyat, ödeme tek satırda"
        onClick={() => onChange("table")}
        icon={Table2}
        label="Tablo"
      />
      <Btn
        active={value === "comfort"}
        title="Konforlu görünüm"
        onClick={() => onChange("comfort")}
        icon={LayoutGrid}
        label="Konforlu"
      />
      <Btn
        active={value === "dense"}
        title="Yoğun görünüm — 20+ çocuk bir ekranda"
        onClick={() => onChange("dense")}
        icon={Rows3}
        label="Yoğun"
      />
    </div>
  )
}

function Btn({ active, onClick, icon: Icon, label, title }: {
  active: boolean; onClick: () => void; icon: typeof Rows3; label: string; title: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors",
        active
          ? "bg-violet-500 text-white"
          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  )
}
