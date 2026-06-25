"use client"

import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSettingsSection } from "@/lib/settings/settings-store"
import type { DurationOption } from "@/types/hizli-kayit"

// ─── Session Duration Picker (Section 3) ─────────────────────────────────────
//
// A single duration choice that applies to ALL children in the current
// registration. Reads packages from /ayarlar so the operator's configured
// labels and prices show up here. Down-buckets each settings package into
// the DurationOption enum (30 | 60 | 90 | "free") that the rest of the
// registration pipeline expects.

interface Props {
  duration:    DurationOption | null
  unitPrice:   number               // ₺/child for current selection
  childCount:  number
  onChange:    (duration: DurationOption, unitPrice: number) => void
}

function toDurationOption(durationMin: number): DurationOption {
  if (durationMin <= 0)  return "free"
  if (durationMin <= 30) return 30
  if (durationMin <= 60) return 60
  return 90
}

export function SessionDurationPicker({ duration, unitPrice, childCount, onChange }: Props) {
  const packages = useSettingsSection("packages")
  const items    = packages.items.filter((p) => p.active)
  const lineTotal = unitPrice * Math.max(0, childCount)

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Oyun Süresi</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {childCount > 0 ? `${childCount} çocuğa uygulanır` : "Önce çocuk ekle"}
            </p>
          </div>
        </div>
        {duration !== null && childCount > 0 && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Oyun toplamı</p>
            <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">
              ₺{lineTotal.toLocaleString("tr-TR")}
            </p>
          </div>
        )}
      </div>

      <div className={cn(
        "grid gap-2",
        items.length <= 3 ? "grid-cols-3" : items.length === 4 ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-3",
      )}>
        {items.map((pkg) => {
          const opt = toDurationOption(pkg.durationMin)
          const active = duration === opt && unitPrice === pkg.price
          return (
            <button
              key={pkg.id}
              onClick={() => onChange(opt, pkg.price)}
              className={cn(
                "rounded-xl py-3 transition-all border-2 flex flex-col items-center gap-0.5 active:scale-95",
                active
                  ? "bg-gradient-to-br from-violet-600 to-purple-600 border-transparent text-white shadow-lg shadow-violet-500/25"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-violet-400",
              )}
            >
              <span className="text-sm font-bold">{pkg.label}</span>
              <span className={cn("text-[11px] font-bold tabular-nums", active ? "text-white/85" : "text-slate-500")}>
                ₺{pkg.price.toLocaleString("tr-TR")}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
