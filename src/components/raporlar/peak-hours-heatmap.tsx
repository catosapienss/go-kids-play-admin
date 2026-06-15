"use client"

import { useEffect, useMemo, useState } from "react"
import { Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { getPeakHoursHeatmap } from "@/lib/services/reports.service"
import { type PeakHourCell } from "@/types/reports"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"

// ─── Peak Hours Heatmap ──────────────────────────────────────────────────────
//
// Day-of-week × hour-of-day grid coloured by session count. Hottest cell is
// the peak operational window — operators use this to plan staff schedules
// + targeted promotions.

const DAYS_TR  = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"] // Sunday-first (PG DOW)
const HOURS    = Array.from({ length: 14 }, (_, i) => i + 9)        // 09:00–22:00 (most useful range)

export function PeakHoursHeatmap() {
  const { range } = useDateRange()
  const [data, setData] = useState<PeakHourCell[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    void getPeakHoursHeatmap(range)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [range, reconnectToken])

  // Pivot the flat list to a fast lookup table + compute max for scaling.
  const { grid, max, peak } = useMemo(() => {
    const grid = new Map<string, number>()
    let max = 0
    let peak: { weekday: number; hour: number; count: number } | null = null
    for (const c of data ?? []) {
      grid.set(`${c.weekday}-${c.hour}`, c.count)
      if (c.count > max) { max = c.count; peak = c }
    }
    return { grid, max, peak }
  }, [data])

  if (!data && !error) return <PanelSkeleton height={300} />
  if (error)            return <EmptyState title="Yoğunluk verisi okunamadı" body={error} tone="danger" />
  if (!data || data.length === 0) return <EmptyState title="Bu aralıkta giriş kaydı yok" />

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Yoğunluk Haritası</p>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
            En yoğun saat:{" "}
            <span className="font-bold text-orange-600 dark:text-orange-400">
              {peak ? `${DAYS_TR[peak.weekday] ?? "—"} · ${String(peak.hour).padStart(2, "0")}:00` : "—"}
            </span>
            {peak && <span className="text-slate-400 ml-2">{peak.count} giriş</span>}
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="border-separate border-spacing-1 text-[10px] mx-auto">
          <thead>
            <tr>
              <th />
              {HOURS.map((h) => (
                <th key={h} className="font-semibold text-slate-400 dark:text-slate-500 pb-1 text-center w-7">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Monday-first display: render Mon(1)..Sat(6),Sun(0) */}
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
              <tr key={wd}>
                <th className="font-semibold text-slate-400 dark:text-slate-500 pr-1 text-right">
                  {DAYS_TR[wd]}
                </th>
                {HOURS.map((h) => {
                  const v = grid.get(`${wd}-${h}`) ?? 0
                  const intensity = max === 0 ? 0 : v / max
                  return (
                    <td key={h}>
                      <div
                        title={`${DAYS_TR[wd]} ${String(h).padStart(2,"0")}:00 — ${v} giriş`}
                        className={cn(
                          "w-7 h-7 rounded-md transition-colors flex items-center justify-center font-mono",
                          intensity === 0
                            ? "bg-slate-100 dark:bg-slate-800/60 text-transparent"
                            : intensity < 0.25
                            ? "bg-violet-200/60  dark:bg-violet-500/15 text-violet-700/0"
                            : intensity < 0.5
                            ? "bg-violet-400/60  dark:bg-violet-500/40 text-white"
                            : intensity < 0.75
                            ? "bg-violet-500/80  dark:bg-violet-500/70 text-white"
                            : "bg-violet-600 dark:bg-violet-500 text-white",
                        )}
                      >
                        {v > 0 && intensity > 0.4 ? v : ""}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-400">
        <span>Az</span>
        {[0.1, 0.25, 0.5, 0.75, 1].map((i) => (
          <div
            key={i}
            className={cn(
              "w-5 h-3 rounded",
              i < 0.25 ? "bg-violet-200/60 dark:bg-violet-500/15"
              : i < 0.5 ? "bg-violet-400/60 dark:bg-violet-500/40"
              : i < 0.75 ? "bg-violet-500/80 dark:bg-violet-500/70"
              : "bg-violet-600 dark:bg-violet-500",
            )}
          />
        ))}
        <span>Çok</span>
      </div>
    </div>
  )
}
