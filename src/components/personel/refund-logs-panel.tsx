"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Clock, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { listTodayRefunds } from "@/lib/services/staff-shift.service"
import { type StaffActivity, formatRelativeShort } from "@/types/staff-shift"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { EmptyState } from "@/components/system/empty-state"

// ─── RefundLogsPanel ──────────────────────────────────────────────────────────
//
// Dedicated dashboard for today's refund activity — the highest-leverage
// audit surface for spotting operational issues (over-refunds, abuse, etc.)
// Each entry shows: kim · ne kadar · neden · saat kaçta · hangi oturum için.

function fmtAmount(v: unknown): string | null {
  if (v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return `₺${n.toLocaleString("tr-TR")}`
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  } catch { return "" }
}

export function RefundLogsPanel() {
  const [rows, setRows] = useState<StaffActivity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setError(null)
    void listTodayRefunds()
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    const id = setInterval(() => {
      void listTodayRefunds()
        .then((r) => { if (!cancelled) setRows(r) })
        .catch(() => undefined)
    }, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [reconnectToken])

  const total = (rows ?? []).reduce((s, r) => s + (Number(r.meta?.amount) || 0), 0)

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bugünkü İadeler</h3>
        <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold tabular-nums ml-auto">
          {rows?.length ?? 0} kayıt
          {total > 0 && ` · ₺${total.toLocaleString("tr-TR")}`}
        </span>
      </div>

      {error ? (
        <EmptyState title="İade verisi okunamadı" body={error} tone="danger" />
      ) : rows === null ? (
        <div className="p-4 space-y-2 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Bugün iade yok" body="Operasyon temiz — günün iade kaydı yok." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {rows.map((row) => {
            const amount = fmtAmount(row.meta?.amount)
            const reason = typeof row.meta?.reason === "string" ? row.meta.reason : null
            const note   = typeof row.meta?.note   === "string" ? row.meta.note   : null
            return (
              <li key={row.id} className="px-5 py-3 hover:bg-rose-50/30 dark:hover:bg-rose-500/[0.03]">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {amount && (
                        <span className="text-base font-black tabular-nums text-rose-700 dark:text-rose-300">{amount}</span>
                      )}
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />
                        {row.staffName ?? "—"}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-auto flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {fmtTime(row.createdAt)}
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        {formatRelativeShort(row.createdAt)}
                      </span>
                    </div>
                    {reason && (
                      <p className="text-xs text-slate-700 dark:text-slate-200 mt-1">
                        <span className={cn("inline-block text-[10px] uppercase tracking-wider font-bold text-rose-600 dark:text-rose-400 mr-1.5")}>Sebep:</span>
                        {reason}
                      </p>
                    )}
                    {note && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 italic">
                        “{note}”
                      </p>
                    )}
                    {row.entityId && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-mono truncate">
                        oturum: {row.entityId.slice(0, 8)}…
                      </p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
