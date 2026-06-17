"use client"

import { useCallback, useEffect, useState } from "react"
import {
  X, Clock, LogOut, AlertTriangle, CheckCircle2, Loader2, Filter, RotateCcw,
} from "lucide-react"
import {
  fetchCompletionLog, END_REASON_LABELS, type CompletionLogRow,
} from "@/lib/services/session.service"
import { cn } from "@/lib/utils"

// ─── Completion History Panel ────────────────────────────────────────────────
//
// Slide-in overlay shown to managers/admins from /aktif-oyun. Lists the most
// recent 50 completed sessions, with filters for normal vs early exits and
// the audit fields (who ended it, when, reason, note).

interface Props { onClose: () => void }

type FilterKey = "all" | "early" | "normal"

const FILTER_LABELS: Record<FilterKey, string> = {
  all:    "Tümü",
  early:  "Erken Çıkış",
  normal: "Normal",
}

export function CompletionHistoryPanel({ onClose }: Props) {
  const [rows, setRows]       = useState<CompletionLogRow[]>([])
  const [filter, setFilter]   = useState<FilterKey>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await fetchCompletionLog({ limit: 100, filter })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void reload() }, [reload])

  return (
    <div className="fixed inset-0 z-[8000] flex justify-end bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <Clock className="w-4 h-4 text-violet-500" />
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Tamamlanan Oturumlar</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Son 100 kayıt · sebep + erken çıkış işaretli
            </p>
          </div>
          <button onClick={() => void reload()} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white" title="Yenile">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter pills */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors",
                filter === k
                  ? k === "early"
                    ? "bg-amber-600 text-white"
                    : "bg-violet-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700",
              )}
            >
              {FILTER_LABELS[k]}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-12">Bu filtrede kayıt yok.</p>
          )}

          {rows.map((r) => <CompletionCard key={r.id} row={r} />)}
        </div>
      </div>
    </div>
  )
}

// ─── per-row card ────────────────────────────────────────────────────────────

function CompletionCard({ row }: { row: CompletionLogRow }) {
  const actualEnd = row.actual_end ? new Date(row.actual_end) : null
  const plannedEnd = row.planned_end ? new Date(row.planned_end) : null
  const start = row.start_time ? new Date(row.start_time) : null

  const fmtTime = (d: Date | null) =>
    d ? d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—"
  const fmtMin = (n: number) => n === 0 ? "Serbest" : `${n} dk`

  const reasonLabel = row.end_reason
    ? END_REASON_LABELS[row.end_reason as keyof typeof END_REASON_LABELS] ?? row.end_reason
    : "—"

  return (
    <div className={cn(
      "rounded-xl border bg-white dark:bg-slate-900 p-3 space-y-2",
      row.early_exit
        ? "border-amber-200 dark:border-amber-500/30"
        : "border-slate-200 dark:border-slate-800",
    )}>
      <div className="flex items-start gap-2.5">
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0",
          row.early_exit
            ? "bg-gradient-to-br from-amber-500 to-orange-500"
            : "bg-gradient-to-br from-emerald-500 to-green-600",
        )}>
          {row.early_exit ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {row.child_name}
            <span className="text-slate-400 font-normal ml-1.5">· {row.parent_name}</span>
          </p>
          <p className="text-[10px] text-slate-500">
            {row.parent_phone ?? ""}
          </p>
        </div>
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
          row.early_exit
            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
        )}>
          {row.early_exit ? "Erken Çıkış" : "Tamamlandı"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        <Stat label="Planlanan" value={fmtMin(row.duration_minutes)} />
        <Stat label="Başlangıç" value={fmtTime(start)} />
        <Stat label="Bitiş"     value={fmtTime(actualEnd)} />
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-1.5 border-t border-slate-100 dark:border-slate-800">
        <LogOut className="w-3 h-3 text-slate-400" />
        <span className="font-semibold">{reasonLabel}</span>
        {row.ended_by_name && (
          <span className="ml-auto text-slate-400">
            · {row.ended_by_username || row.ended_by_name}
          </span>
        )}
      </div>

      {row.end_note && (
        <p className="text-[11px] italic text-slate-500 dark:text-slate-400 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40">
          "{row.end_note}"
        </p>
      )}

      {plannedEnd && actualEnd && row.early_exit && (
        <p className="text-[10px] text-amber-700 dark:text-amber-300">
          Planlanan {plannedEnd.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} → {Math.round((plannedEnd.getTime() - actualEnd.getTime()) / 60000)} dk erken bitti
        </p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 px-2 py-1">
      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
      <p className="text-[11px] font-semibold text-slate-900 dark:text-white truncate">{value}</p>
    </div>
  )
}
