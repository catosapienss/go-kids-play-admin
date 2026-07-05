"use client"

import { useEffect, useState } from "react"
import {
  TrendingUp, TrendingDown, ArrowRight,
  CalendarDays, Calendar, CalendarRange,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getRevenuePeriods } from "@/lib/services/reports.service"
import {
  deltaPct, type RevenuePeriods, type PeriodTotal,
} from "@/types/reports"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"

// ─── Revenue Period Cards ─────────────────────────────────────────────────────
//
// 4-up KPI strip comparing today / 7-day / 30-day / 1-year revenue with
// prior-period delta (% change). One read per page (single RPC).

function fmtTRY(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

function Delta({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-400">
        <ArrowRight className="w-3 h-3" /> —
      </span>
    )
  }
  const positive = value >= 0
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[11px] font-semibold",
      positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
    )}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? "+" : ""}{value.toFixed(1)}%
    </span>
  )
}

interface CardProps {
  label: string
  icon: typeof Calendar
  current: PeriodTotal
  prior: PeriodTotal | null
  hint: string
}

function PeriodCard({ label, icon: Icon, current, prior, hint }: CardProps) {
  const delta = prior ? deltaPct(current.net, prior.net) : null
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 flex-1">{label}</p>
        {prior && <Delta value={delta} />}
      </div>
      <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-white leading-tight">
        {fmtTRY(current.net)}
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
        {current.sessionCount.toLocaleString("tr-TR")} oturum · {current.txCount.toLocaleString("tr-TR")} ödeme
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{hint}</p>
    </div>
  )
}

export function RevenuePeriodCards() {
  const [data, setData] = useState<RevenuePeriods | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setError(null)
    void getRevenuePeriods()
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [reconnectToken])

  if (!data && !error) return <PanelSkeleton height={120} />
  if (!data) return null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <PeriodCard label="Bugün"       icon={Calendar}     current={data.today} prior={data.yesterday} hint="Dünle karşılaştırma" />
      <PeriodCard label="Son 7 gün"  icon={CalendarDays} current={data.week}  prior={data.prevWeek}  hint="Önceki haftaya göre" />
      <PeriodCard label="Son 30 gün" icon={CalendarDays} current={data.month} prior={data.prevMonth} hint="Önceki 30 güne göre" />
      <PeriodCard label="Son 365 gün" icon={CalendarRange} current={data.year} prior={null} hint="Yıllık genel görünüm" />
    </div>
  )
}
