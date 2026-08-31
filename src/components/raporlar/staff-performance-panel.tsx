"use client"

import { useEffect, useState } from "react"
import { Users, Download, AlertTriangle, Clock, UserX } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { getStaffPerformance, downloadCsv } from "@/lib/services/reports.service"
import { type StaffPerformanceRow } from "@/types/reports"
import {
  getStaffDirectory, formerStaffNames, isFormerStaffName,
} from "@/lib/services/staff-directory.service"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"

// ─── Staff Performance Panel ──────────────────────────────────────────────────
//
// Per-staff rollup for the chosen date range: oturum sayısı, iade sayısı,
// iade oranı, toplam çalışma saati. Sorted by session count.
//
// get_staff_performance groups by the DENORMALISED name recorded on each row
// (sessions.staff_name, refund_logs.staff_note), so a departed employee keeps
// appearing for the dates they actually worked — which is the point: picking
// July shows July's team. What the report adds here is the distinction the
// owner needs when reading it today: an "Ayrıldı" badge and a filter, so
// current staff can be told apart from former staff at a glance without any
// historical figure being hidden or reattributed.

function fmtHours(seconds: number): string {
  if (seconds <= 0) return "0sa"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}sa ${m}dk`
  return `${m}dk`
}

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "?"
}

const PALETTE = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
]

type StaffFilter = "all" | "current" | "former"

const FILTER_LABELS: Record<StaffFilter, string> = {
  all:     "Tümü",
  current: "Aktif personel",
  former:  "Ayrılan personel",
}

export function StaffPerformancePanel() {
  const { range } = useDateRange()
  const [rows, setRows] = useState<StaffPerformanceRow[] | null>(null)
  const [former, setFormer] = useState<Set<string>>(() => new Set())
  const [filter, setFilter] = useState<StaffFilter>("all")
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    void getStaffPerformance(range)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [range, reconnectToken])

  // Who still works here. Independent of the date range — the roster is a fact
  // about today, not about the reporting period. A failure here just means no
  // badges; the figures are never affected.
  useEffect(() => {
    let cancelled = false
    void getStaffDirectory()
      .then((dir) => { if (!cancelled) setFormer(formerStaffNames(dir)) })
      .catch(() => { /* badges are decoration — never block the report */ })
    return () => { cancelled = true }
  }, [reconnectToken])

  const visible = (rows ?? []).filter((r) => {
    if (filter === "all") return true
    const isFormer = isFormerStaffName(r.staffName, former)
    return filter === "former" ? isFormer : !isFormer
  })

  function handleExport() {
    if (!rows) return
    downloadCsv(`personel-${range.from.toISOString().slice(0, 10)}.csv`, visible.map((r) => ({
      Personel: r.staffName,
      Durum: isFormerStaffName(r.staffName, former) ? "Ayrıldı" : "Aktif",
      Oturum: r.sessionCount,
      Iade: r.refundCount,
      IadeOrani: r.refundRate,
      CalismaSn: r.activeSeconds,
    })))
  }

  if (!rows && !error) return <PanelSkeleton height={320} />
  if (error)            return <EmptyState title="Personel verisi okunamadı" body={error} tone="danger" />
  if (!rows) return null

  const maxSession = Math.max(1, ...rows.map((r) => r.sessionCount))
  const formerCount = rows.filter((r) => isFormerStaffName(r.staffName, former)).length

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Users className="w-3.5 h-3.5 text-blue-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Personel Performansı</h3>
        <span className="text-[11px] text-slate-400 ml-auto tabular-nums">
          {visible.length} kişi
        </span>
        <button
          type="button"
          onClick={handleExport}
          disabled={visible.length === 0}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
        >
          <Download className="w-3 h-3" /> CSV
        </button>
      </div>

      {formerCount > 0 && (
        <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
          {(["all", "current", "former"] as StaffFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors",
                filter === f
                  ? "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50",
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
          <span className="text-[10px] text-slate-400 ml-auto">
            Ayrılan personel geçmiş dönemlerde görünmeye devam eder
          </span>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState title="Bu aralıkta işlem yok" body="Personel aktiviteleri burada görünecek." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {visible.map((r, i) => (
            <li key={r.staffName + i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div className={cn(
                "w-9 h-9 rounded-xl bg-gradient-to-br text-white text-xs font-bold flex items-center justify-center flex-shrink-0",
                PALETTE[i % PALETTE.length],
              )}>
                {initials(r.staffName)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {r.staffName}
                    {isFormerStaffName(r.staffName, former) && (
                      <span
                        title="Bu personel artık çalışmıyor — geçmiş kayıtları olduğu gibi korunur"
                        className="ml-2 inline-flex items-center gap-0.5 align-middle text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      >
                        <UserX className="w-2.5 h-2.5" /> Ayrıldı
                      </span>
                    )}
                  </p>
                  <p className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200 flex-shrink-0">
                    {r.sessionCount.toLocaleString("tr-TR")}
                    <span className="text-[10px] font-medium text-slate-400 ml-1">oturum</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                      style={{ width: `${(r.sessionCount / maxSession) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] flex-shrink-0">
                    <span className="inline-flex items-center gap-0.5 text-slate-500 dark:text-slate-400 tabular-nums">
                      <Clock className="w-2.5 h-2.5" /> {fmtHours(r.activeSeconds)}
                    </span>
                    {r.refundCount > 0 && (
                      <span
                        title="Bu personel kaç iade yaptı"
                        className={cn(
                          "inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded-md tabular-nums",
                          r.refundRate > 10
                            ? "bg-rose-500/15  text-rose-700  dark:text-rose-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {r.refundCount} · %{r.refundRate.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
