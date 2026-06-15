"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Radio, Filter, AlertTriangle, RotateCcw, CreditCard, Wallet, Clock,
  ShieldCheck, KeyRound, Sparkles, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { listStaffActivity } from "@/lib/services/staff-shift.service"
import {
  type StaffActivity, describeAction, formatRelativeShort,
} from "@/types/staff-shift"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { useAuth } from "@/contexts/auth-context"
import { EmptyState } from "@/components/system/empty-state"

// ─── RealActivityTimeline ─────────────────────────────────────────────────────
//
// Reads from the audit_logs table (via list_staff_activity RPC) and renders
// a live operational feed. Three role-aware modes:
//
//   • cashier   → forced filter to their own user_id (server enforces too)
//   • manager   → branch-wide feed, can filter by user_id
//   • super_admin → cross-branch (still scoped client-side by active branch)
//
// Polls every 10s. A future refinement could subscribe via Supabase realtime
// to the `audit_logs` channel — saved for when the audit volume justifies it.

const TONES: Record<string, { bg: string; fg: string; ring: string }> = {
  violet:  { bg: "bg-violet-500/10",  fg: "text-violet-700 dark:text-violet-300",  ring: "ring-violet-500/30" },
  blue:    { bg: "bg-blue-500/10",    fg: "text-blue-700 dark:text-blue-300",      ring: "ring-blue-500/30" },
  emerald: { bg: "bg-emerald-500/10", fg: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/30" },
  amber:   { bg: "bg-amber-500/10",   fg: "text-amber-700 dark:text-amber-300",    ring: "ring-amber-500/30" },
  rose:    { bg: "bg-rose-500/10",    fg: "text-rose-700 dark:text-rose-300",      ring: "ring-rose-500/30" },
  slate:   { bg: "bg-slate-500/10",   fg: "text-slate-700 dark:text-slate-300",    ring: "ring-slate-500/30" },
}

function iconForAction(action: string): LucideIcon {
  if (action.startsWith("payment."))             return CreditCard
  if (action.startsWith("refund."))              return AlertTriangle
  if (action.startsWith("wallet."))              return Wallet
  if (action.startsWith("session.extend"))       return Clock
  if (action.startsWith("session.convert"))      return Sparkles
  if (action.startsWith("cash_register."))       return ShieldCheck
  if (action.startsWith("entry_code."))          return KeyRound
  return Radio
}

interface Props {
  /** When provided, locks the timeline to one user (cashier view). */
  forceUserId?: string
  /** Visible cap. Default 30. */
  limit?: number
  className?: string
}

export function RealActivityTimeline({ forceUserId, limit = 30, className }: Props) {
  const { user } = useAuth()
  const [rows, setRows] = useState<StaffActivity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRefundsOnly, setShowRefundsOnly] = useState(false)
  const reconnectToken = useReconnectToken()

  // Cashiers may only see their own actions; force the filter even if caller forgot.
  const effectiveUserId = useMemo(() => {
    if (forceUserId) return forceUserId
    if (user?.role === "cashier") return user.id
    return undefined
  }, [forceUserId, user])

  useEffect(() => {
    let cancelled = false
    setError(null)

    async function load() {
      try {
        const r = await listStaffActivity({
          userId: effectiveUserId,
          actionLike: showRefundsOnly ? "refund.%" : undefined,
          limit,
        })
        if (!cancelled) setRows(r)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi")
      }
    }

    void load()
    const id = setInterval(load, 10_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [effectiveUserId, showRefundsOnly, limit, reconnectToken])

  return (
    <div className={cn(
      "rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden flex flex-col",
      className,
    )}>
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <div className="relative w-5 h-5 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
          <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aktivite Akışı</h3>
        <span className="text-[11px] text-slate-400 ml-auto">
          {rows ? `${rows.length} kayıt · son 10s` : "Yükleniyor…"}
        </span>
        <button
          type="button"
          onClick={() => setShowRefundsOnly((v) => !v)}
          className={cn(
            "ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors inline-flex items-center gap-1",
            showRefundsOnly
              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700",
          )}
          title="Sadece iade kayıtlarını göster"
        >
          <Filter className="w-2.5 h-2.5" />
          {showRefundsOnly ? "İADE" : "TÜMÜ"}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {error ? (
          <EmptyState
            title="Aktivite verisi okunamadı"
            body={error}
            tone="danger"
            onRetry={() => setRows(null)}
          />
        ) : rows === null ? (
          <div className="p-4 space-y-2 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Henüz aktivite yok"
            body={showRefundsOnly ? "Bugün iade kaydı yapılmadı." : "Operasyon başladığında akış burada görünecek."}
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {rows.map((row) => {
              const Icon = iconForAction(row.action)
              const desc = describeAction(row.action, row.meta)
              const t = TONES[desc.tone] ?? TONES.slate
              const isError = row.severity === "error"
              const isWarning = row.severity === "warning"
              return (
                <li key={row.id} className="flex items-start gap-3 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                    t.bg, t.fg,
                    isError && "ring-2 ring-rose-500/40",
                    isWarning && "ring-2 ring-amber-500/40",
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {row.staffName ?? "—"}
                      </span>
                      <span className={cn("text-xs", t.fg)}>{desc.verb}</span>
                      {desc.detail && (
                        <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300">
                          {desc.detail}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">
                        {formatRelativeShort(row.createdAt)}
                      </span>
                    </div>
                    {row.action === "refund.cancel" && row.meta?.reason ? (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 truncate">
                        Sebep: {String(row.meta.reason)}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
