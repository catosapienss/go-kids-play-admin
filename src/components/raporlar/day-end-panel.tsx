"use client"

import { useEffect, useMemo, useState } from "react"
import { useDashboardMetrics } from "@/hooks/use-analytics"
import { createClient } from "@/lib/supabase/client"
import { useBranchScope } from "@/lib/branch/branch-context"
import { withBranchScope } from "@/lib/branch/scoped-query"
import { cn } from "@/lib/utils"
import {
  Banknote, CreditCard, Wallet, RotateCcw, FileText,
  Users, Clock, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react"
import { isReconciled } from "@/types/cash-register"
import { EmptyState } from "@/components/system/empty-state"

// ─── Day-End Reconciliation Panel ────────────────────────────────────────────
//
// Single-screen close-of-day view designed for the manager / shift lead.
// Every number the operator needs to balance the till at end of day:
//
//   • Gross revenue + net revenue (after refunds)
//   • Cash / Card / Wallet breakdown (must reconcile to till)
//   • Wallet activity (loaded vs spent)
//   • Refund count + total
//   • Session count + average duration
//   • Reconciliation status line at the bottom — green ✓ if math balances.
//
// Designed to be print-friendly (no inline gradients on critical numbers).

function fmtTRY(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

interface DayEndExtras {
  sessionCount: number
  refundCount: number
  avgDurationMin: number
}

async function fetchDayEndExtras(scope: ReturnType<typeof useBranchScope>): Promise<DayEndExtras> {
  const supabase = createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Local typed-loose scope helper to dodge the deeply-generic Supabase builder
  // types that triggered TS2589 when passed directly.
  type AnyEq = { eq(col: string, value: unknown): AnyEq }
  function applyScope<T>(q: T): T {
    return withBranchScope(q as unknown as AnyEq, scope) as unknown as T
  }

  const [sessionsRes, refundsRes] = await Promise.all([
    applyScope(supabase.from("sessions").select("duration_minutes, branch_id"))
      .gte("created_at", today.toISOString()),
    applyScope(supabase.from("refund_logs").select("id, branch_id"))
      .gte("created_at", today.toISOString()),
  ])

  const sessions = sessionsRes.data ?? []
  const refunds  = refundsRes.data ?? []
  const totalDur = sessions.reduce((s, r) => s + (Number(r.duration_minutes) || 0), 0)

  return {
    sessionCount:   sessions.length,
    refundCount:    refunds.length,
    avgDurationMin: sessions.length > 0 ? Math.round(totalDur / sessions.length) : 0,
  }
}

export function DayEndPanel() {
  const { data, isLoading, error, refresh } = useDashboardMetrics()
  const scope = useBranchScope()
  const [extras, setExtras] = useState<DayEndExtras | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchDayEndExtras(scope).then((e) => { if (!cancelled) setExtras(e) })
    return () => { cancelled = true }
  }, [scope])

  const reconciliation = useMemo(() => {
    if (!data) return null
    const sum  = data.totalCash + data.totalCard + data.totalWallet
    const diff = Math.abs(sum - data.totalRevenue)
    // Use the same 0.005 tolerance as isReconciled() in cash-register types.
    const balanced = isReconciled(diff)
    // Warning band: small diff under ₺50 is unusual but not alarming.
    const warn = !balanced && diff < 50
    return { sum, diff, balanced, warn }
  }, [data])

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900">
        <EmptyState
          title="Gün sonu verisi alınamadı"
          body={error ?? "Verileri tekrar çekmeyi dene."}
          onRetry={refresh}
          tone="danger"
        />
      </div>
    )
  }

  const today = new Date()
  const dateLabel = today.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Gün Sonu Mutabakat
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{dateLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Net Ciro</p>
          <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white leading-none mt-1">
            {fmtTRY(data.netRevenue)}
          </p>
          {data.totalRefunded > 0 && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">
              -{fmtTRY(data.totalRefunded)} iade
            </p>
          )}
        </div>
      </div>

      {/* Payment method breakdown */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-3">
          Ödeme Yöntemi
        </p>
        <div className="grid grid-cols-3 gap-3">
          <MethodBlock icon={Banknote}   label="Nakit"  value={data.totalCash}   tone="emerald" />
          <MethodBlock icon={CreditCard} label="Kart"   value={data.totalCard}   tone="blue" />
          <MethodBlock icon={Wallet}     label="Cüzdan" value={data.totalWallet} tone="violet" />
        </div>
      </div>

      {/* Wallet activity + refunds + ops */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-slate-100 dark:border-slate-800">
        <MiniStat icon={Wallet}      label="Cüzdan Yükleme"  value={fmtTRY(data.walletLoaded)} tone="violet" />
        <MiniStat icon={RotateCcw}   label="İade"  value={data.totalRefunded > 0 ? fmtTRY(data.totalRefunded) : "—"} tone={data.totalRefunded > 0 ? "rose" : "slate"} sub={extras ? `${extras.refundCount} işlem` : undefined} />
        <MiniStat icon={Users}       label="Toplam Giriş"     value={String(data.todayEntries)} tone="indigo" />
        <MiniStat icon={Clock}       label="Ort. Süre" value={extras ? `${extras.avgDurationMin} dk` : "—"} tone="amber" />
      </div>

      {/* Reconciliation status */}
      {reconciliation && (
        <ReconciliationBand reconciliation={reconciliation} data={data} />
      )}
    </div>
  )
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function MethodBlock({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  tone: "emerald" | "blue" | "violet"
}) {
  const TONES = {
    emerald: { bg: "bg-emerald-500/8", iconBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", fg: "text-emerald-700 dark:text-emerald-300" },
    blue:    { bg: "bg-blue-500/8",    iconBg: "bg-blue-500/15 text-blue-700 dark:text-blue-300",         fg: "text-blue-700 dark:text-blue-300" },
    violet:  { bg: "bg-violet-500/8",  iconBg: "bg-violet-500/15 text-violet-700 dark:text-violet-300",   fg: "text-violet-700 dark:text-violet-300" },
  }
  const t = TONES[tone]
  return (
    <div className={cn("rounded-xl p-3 flex items-center gap-3", t.bg)}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", t.iconBg)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
        <p className={cn("text-xl font-bold tabular-nums leading-tight", t.fg)}>{fmtTRY(value)}</p>
      </div>
    </div>
  )
}

// ─── Reconciliation band ──────────────────────────────────────────────────────
//
// Three visual states:
//   EŞLEŞTI  (balanced) — diff < ₺0.005
//   UYARI    (warning)  — diff ₺0.005–₺49.99  (small variance, investigate)
//   UYUMSUZ  (mismatch) — diff ≥ ₺50           (action required)

function ReconciliationBand({
  reconciliation,
  data,
}: {
  reconciliation: { sum: number; diff: number; balanced: boolean; warn: boolean }
  data: { totalRevenue: number }
}) {
  const { balanced, warn, sum, diff } = reconciliation

  const cfg = balanced
    ? {
        container: "bg-emerald-50/60 dark:bg-emerald-500/[0.05] border-t border-emerald-200/50 dark:border-emerald-900/40",
        icon: <CheckCircle2 className="w-4 h-4" />,
        iconBg:  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        badge:   "bg-emerald-500 text-white",
        badgeLabel: "EŞLEŞTİ",
        titleFg: "text-emerald-800 dark:text-emerald-200",
        subFg:   "text-emerald-700/80 dark:text-emerald-300/80",
        title:   "Mutabakat tutarlı — kasa dengede.",
      }
    : warn
    ? {
        container: "bg-amber-50/60 dark:bg-amber-500/[0.05] border-t border-amber-200/50 dark:border-amber-900/40",
        icon: <AlertTriangle className="w-4 h-4" />,
        iconBg:  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        badge:   "bg-amber-500 text-white",
        badgeLabel: "UYARI",
        titleFg: "text-amber-800 dark:text-amber-200",
        subFg:   "text-amber-700/80 dark:text-amber-300/80",
        title:   "Küçük fark tespit edildi — araştır.",
      }
    : {
        container: "bg-rose-50/60 dark:bg-rose-500/[0.05] border-t border-rose-200/50 dark:border-rose-900/40",
        icon: <XCircle className="w-4 h-4" />,
        iconBg:  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        badge:   "bg-rose-600 text-white",
        badgeLabel: "UYUMSUZ",
        titleFg: "text-rose-800 dark:text-rose-200",
        subFg:   "text-rose-700/80 dark:text-rose-300/80",
        title:   "Önemli fark var — harekete geç.",
      }

  return (
    <div className={cn("px-6 py-4 flex items-center gap-3", cfg.container)}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", cfg.iconBg)}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn("text-[9px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded-full", cfg.badge)}>
            {cfg.badgeLabel}
          </span>
          <p className={cn("text-sm font-bold", cfg.titleFg)}>{cfg.title}</p>
        </div>
        <p className={cn("text-[11px] tabular-nums", cfg.subFg)}>
          Yöntemler: {fmtTRY(sum)} · Sistem: {fmtTRY(data.totalRevenue)}
          {!balanced && (
            <span className="font-bold ml-1">· Fark: {fmtTRY(diff)}</span>
          )}
        </p>
      </div>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, tone, sub }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  tone: "violet" | "rose" | "indigo" | "amber" | "slate"
}) {
  const TONES = {
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    rose:   "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    amber:  "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    slate:  "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  }
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", TONES[tone])}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white leading-tight truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  )
}
