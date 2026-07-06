"use client"

import { useEffect, useMemo, useState } from "react"
import { NotebookPen, Loader2, Download, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { useBranchScope } from "@/lib/branch/branch-context"
import { listOperationNotes } from "@/lib/services/operations-log.service"
import { OperationNotesTimeline } from "@/components/operations-log/operation-notes-timeline"
import type { OperationNote } from "@/types/operations-log"

// ─── Reports · Daily Operations Notes ────────────────────────────────────────
//
// Filterable operational history: date range (from the global picker) + staff.
// Branch scope is applied server-side. Read-only; CSV export for records.

export function DailyNotesReportPanel({ limit = 300 }: { limit?: number }) {
  const { range } = useDateRange()
  const scope = useBranchScope()
  const [all, setAll] = useState<OperationNote[] | null>(null)
  const [staff, setStaff] = useState<string>("all")

  useEffect(() => {
    let cancelled = false
    setAll(null)
    listOperationNotes(
      { fromIso: range.from.toISOString(), toIso: range.to.toISOString(), limit },
      scope,
    ).then((r) => { if (!cancelled) setAll(r) })
      .catch(() => { if (!cancelled) setAll([]) })
    return () => { cancelled = true }
  }, [range.from, range.to, limit, scope])

  // Staff options derived from the loaded rows (no extra query).
  const staffOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const n of all ?? []) {
      if (n.createdBy) map.set(n.createdBy, n.createdByName ?? "Personel")
    }
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [all])

  const rows = useMemo(
    () => (all ?? []).filter((n) => staff === "all" || n.createdBy === staff),
    [all, staff],
  )

  function exportCsv() {
    if (rows.length === 0) return
    const pad = (n: number) => (n < 10 ? "0" + n : String(n))
    const fmt = (iso: string) => {
      const d = new Date(iso)
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    const header = ["Tarih/Saat", "Personel", "Not"]
    const lines = rows.map((r) => [fmt(r.createdAt), r.createdByName ?? "", r.note]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "operasyon_notlari.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 flex items-center justify-center">
            <NotebookPen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Operasyon Not Geçmişi</h2>
            <p className="text-[11px] text-slate-500">Seçili aralıktaki tüm vardiya notları</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500"
            >
              <option value="all">Tüm personel</option>
              {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      <div className={cn("px-5 py-4", rows.length > 0 && "max-h-[520px] overflow-y-auto")}>
        {all === null ? (
          <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
        ) : (
          <OperationNotesTimeline notes={rows} showDate emptyText="Bu aralıkta operasyon notu yok" />
        )}
      </div>
    </div>
  )
}
