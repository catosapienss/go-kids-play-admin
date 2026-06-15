"use client"

import { useEffect, useState } from "react"
import { Archive, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { listRecentClosings } from "@/lib/services/cash-register.service"
import { type CashRegister, isReconciled, totalDiscrepancy } from "@/types/cash-register"
import { EmptyState } from "@/components/system/empty-state"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"

// ─── Closing History ─────────────────────────────────────────────────────────
//
// Recent day-end closings, newest first. Manager can scan for discrepancies at
// a glance via the colour-coded total diff. Clicking a row expands its notes
// inline (no nav — keeps the manager on the day-end screen).

function fmtTRY(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "short", year: "numeric", weekday: "short",
    })
  } catch { return iso }
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  } catch { return "" }
}

export function ClosingHistory() {
  const [rows, setRows] = useState<CashRegister[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    void listRecentClosings(20)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Veri çekilemedi") })
    return () => { cancelled = true }
  }, [reconnectToken])

  if (rows === null && !error) {
    return (
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-6 animate-pulse">
        <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded mb-3" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Archive className="w-3.5 h-3.5 text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Geçmiş Kapanışlar</h3>
        <span className="text-[10px] text-slate-400 ml-auto tabular-nums">{rows?.length ?? 0} kayıt</span>
      </div>

      {error ? (
        <EmptyState title="Geçmiş okunamadı" body={error} tone="danger" />
      ) : rows && rows.length === 0 ? (
        <EmptyState title="Henüz kapanış yok" body="İlk kasa kapatıldığında burada görünecek." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {(rows ?? []).map((r) => {
            const total = totalDiscrepancy(r)
            const ok = isReconciled(total)
            const isExpanded = expanded === r.id
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left"
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    ok
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  )}>
                    {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtDate(r.businessDate)}</span>
                      <span className="text-[11px] text-slate-400">{fmtTime(r.closedAt)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span>₺{fmtTRY(r.expectedTotal)} ciro</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span>{r.transactionCount} işlem</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="truncate">{r.closedByName ?? "—"}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-bold tabular-nums",
                      ok ? "text-emerald-600 dark:text-emerald-400"
                        : total < 0 ? "text-rose-600 dark:text-rose-400"
                        : "text-amber-600 dark:text-amber-400",
                    )}>
                      {ok ? "✓ ₺0" : (total > 0 ? "+" : "") + "₺" + fmtTRY(total)}
                    </p>
                    <p className="text-[10px] text-slate-400">{ok ? "Tutuyor" : "Fark"}</p>
                  </div>

                  <ChevronRight className={cn("w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0", isExpanded && "rotate-90")} />
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 pt-1 space-y-3 bg-slate-50 dark:bg-slate-950/30">
                    <div className="grid grid-cols-3 gap-2">
                      <DiffPair label="Nakit"  expected={r.expectedCash}   counted={r.countedCash}   diff={r.diffCash}   />
                      <DiffPair label="Kart"   expected={r.expectedCard}   counted={r.countedCard}   diff={r.diffCard}   />
                      <DiffPair label="Cüzdan" expected={r.expectedWallet} counted={r.countedWallet} diff={r.diffWallet} />
                    </div>
                    {r.notes && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">Notlar</p>
                        <p className="text-[12px] text-slate-700 dark:text-slate-300 whitespace-pre-line p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          {r.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function DiffPair({ label, expected, counted, diff }: {
  label: string; expected: number; counted: number; diff: number
}) {
  const ok = isReconciled(diff)
  return (
    <div className="rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-2">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-[12px] font-bold tabular-nums text-slate-900 dark:text-white">₺{fmtTRY(counted)}</p>
      <p className="text-[10px] text-slate-400 tabular-nums">Bekl: ₺{fmtTRY(expected)}</p>
      <p className={cn(
        "text-[10px] font-bold tabular-nums mt-0.5",
        ok ? "text-emerald-600 dark:text-emerald-400"
          : diff < 0 ? "text-rose-600 dark:text-rose-400"
          : "text-amber-600 dark:text-amber-400",
      )}>
        {ok ? "✓" : (diff > 0 ? "+" : "") + "₺" + fmtTRY(diff)}
      </p>
    </div>
  )
}
