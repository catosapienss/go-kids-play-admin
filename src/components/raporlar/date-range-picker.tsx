"use client"

import { useEffect, useRef, useState } from "react"
import { Calendar, ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { fmtRange, PRESET_LABEL, type RangePreset } from "@/types/reports"

// ─── DateRangePicker ─────────────────────────────────────────────────────────
//
// Compact preset picker + manual override dropdown. Sits in the report's
// filter bar. Custom dates use two native <input type="date"> for now;
// upgrading to a polished calendar is a one-component swap later.

const PRESETS: RangePreset[] = [
  "today", "yesterday", "last7", "last30", "thisMonth", "lastMonth", "thisYear", "custom",
]

function toInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function DateRangePicker() {
  const { preset, range, setPreset, setCustom } = useDateRange()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Outside click + Escape
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
          "text-sm font-semibold text-slate-700 dark:text-slate-200",
          "hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[40px]",
        )}
      >
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span>{PRESET_LABEL[preset]}</span>
        <span className="text-slate-400 text-xs">· {fmtRange(range)}</span>
        <ChevronsUpDown className="w-3 h-3 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[300px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          <ul className="py-1.5">
            {PRESETS.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => { setPreset(p); if (p !== "custom") setOpen(false) }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                    "hover:bg-slate-50 dark:hover:bg-slate-800",
                    preset === p && "bg-violet-50/60 dark:bg-violet-500/[0.08]",
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 flex items-center justify-center",
                    preset === p ? "text-violet-600 dark:text-violet-400" : "text-transparent",
                  )}>
                    <Check className="w-3 h-3" />
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-200 flex-1">
                    {PRESET_LABEL[p]}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {preset === "custom" && (
            <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-2">
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Başlangıç</span>
                <input
                  type="date"
                  value={toInputValue(range.from)}
                  onChange={(e) => {
                    const newFrom = new Date(e.target.value)
                    setCustom({ from: newFrom, to: range.to })
                  }}
                  className="mt-1 w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Bitiş</span>
                <input
                  type="date"
                  value={toInputValue(new Date(range.to.getTime() - 1))}
                  onChange={(e) => {
                    const endDay = new Date(e.target.value)
                    endDay.setDate(endDay.getDate() + 1)
                    setCustom({ from: range.from, to: endDay })
                  }}
                  className="mt-1 w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
