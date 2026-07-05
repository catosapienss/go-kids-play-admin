"use client"

import { useEffect, useState } from "react"
import { Repeat, Phone, Crown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { listRepeatVisitors } from "@/lib/services/customer.service"
import { type RepeatVisitor } from "@/types/customer"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"
import { CustomerProfileSheet } from "@/components/crm/customer-profile-sheet"

// ─── RepeatVisitorsPanel ──────────────────────────────────────────────────────
//
// Dashboard "today's returning families" insight. Clicking a row pops the
// CustomerProfileSheet — turns a passive metric into an actionable surface
// (greet by name, recall last visit, etc).

function fmtMoney(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "?"
}

export function RepeatVisitorsPanel() {
  const [rows, setRows] = useState<RepeatVisitor[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setError(null)
    void listRepeatVisitors(8)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    // Refresh every 2 min — low-volume insight, no need to hammer.
    const id = setInterval(() => {
      void listRepeatVisitors(8).then((r) => { if (!cancelled) setRows(r) }).catch(() => undefined)
    }, 120_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [reconnectToken])

  if (rows === null && !error) return <PanelSkeleton height={260} />

  return (
    <>
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center">
            <Repeat className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Tekrar Gelen Aileler</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Bugün geri dönen sadık müşteriler</p>
          </div>
          <span className="text-[10px] font-bold tabular-nums text-violet-700 dark:text-violet-300">
            {rows?.length ?? 0}
          </span>
        </div>

        {error ? (
          <EmptyState title="Veri okunamadı" body={error} tone="danger" />
        ) : !rows || rows.length === 0 ? (
          <EmptyState
            title="Bugün geri dönen aile yok"
            body="İlk müşteri geldiğinde liste burada görünecek."
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60 flex-1">
            {rows.map((r) => (
              <li key={r.parentId}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.parentId)}
                  className="w-full text-left flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold flex-shrink-0",
                    r.isVip ? "from-amber-400 to-orange-500" : "from-violet-500 to-purple-600",
                  )}>
                    {initials(r.fullName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.fullName}</p>
                      {r.isVip && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-0.5">
                        <Phone className="w-2.5 h-2.5" />
                        {r.phone}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="tabular-nums">{r.visitCount} ziyaret</span>
                      {r.todayVisits > 1 && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-violet-700 dark:text-violet-300 font-bold">{r.todayVisits}x bugün</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {fmtMoney(r.totalSpent)}
                    </p>
                    <p className="text-[10px] text-slate-400">toplam</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CustomerProfileSheet
        parentId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
      />
    </>
  )
}
