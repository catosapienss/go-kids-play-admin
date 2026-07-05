"use client"

import { useDailyRevenueTrend, useHourlyHeatmap, usePaymentSplit } from "@/hooks/use-analytics"
import { PanelSkeleton } from "./dashboard-skeletons"
import { cn } from "@/lib/utils"
import { TrendingUp, ArrowDownRight, ArrowUpRight } from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

function fmtTRY(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

// ─── Daily revenue (last 7 days) ─────────────────────────────────────────────

export function DailyRevenueChart() {
  const { data, isLoading } = useDailyRevenueTrend(7)
  if (isLoading || !data) return <PanelSkeleton height={240} />

  const last = data[data.length - 1]?.net ?? 0
  const prev = data[data.length - 2]?.net ?? 0
  const delta = prev > 0 ? ((last - prev) / prev) * 100 : 0
  const total = data.reduce((s, d) => s + d.net, 0)

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Gelir Trendi · Son 7 Gün
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{fmtTRY(total)}</span>
            {prev > 0 && (
              <span className={cn(
                "text-xs font-semibold flex items-center gap-0.5",
                delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
              )}>
                {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <TrendingUp className="w-4 h-4" />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={72} tickFormatter={(v) => fmtTRY(Number(v))} />
          <Tooltip
            contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: 12 }}
            labelStyle={{ fontWeight: 600 }}
            formatter={(v, n) => [fmtTRY(Number(v)), n === "net" ? "Net Gelir" : n === "refunds" ? "İade" : "Brüt"]}
          />
          <Area type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2.5} fill="url(#netGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#10b981" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Hourly density (today) ──────────────────────────────────────────────────

export function HourlyDensityChart() {
  const { data, isLoading } = useHourlyHeatmap()
  if (isLoading || !data) return <PanelSkeleton height={240} />

  const peak = data.reduce((m, d) => (d.count > m.count ? d : m), data[0] ?? { hour: "—", count: 0, revenue: 0 })

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Saatlik Yoğunluk · Bugün
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
            Yoğun saat: <span className="font-bold text-violet-600 dark:text-violet-400">{peak.hour}</span>
            <span className="text-slate-400 dark:text-slate-500 ml-2">{peak.count} giriş</span>
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: 12 }}
            labelStyle={{ fontWeight: 600 }}
            formatter={(v, n) => [n === "count" ? `${Number(v)} giriş` : fmtTRY(Number(v)), n === "count" ? "Çocuk" : "Ciro"]}
          />
          <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Payment split — segmented bar + legend ─────────────────────────────────

export function PaymentSplitPanel() {
  const { data, isLoading } = usePaymentSplit()
  if (isLoading || !data) return <PanelSkeleton height={160} />

  const total = data.reduce((s, d) => s + d.amount, 0)

  const colors: Record<string, { bg: string; dot: string; fg: string }> = {
    cash:   { bg: "bg-emerald-500", dot: "bg-emerald-500", fg: "text-emerald-700 dark:text-emerald-400" },
    card:   { bg: "bg-blue-500",    dot: "bg-blue-500",    fg: "text-blue-700 dark:text-blue-400" },
    wallet: { bg: "bg-violet-500",  dot: "bg-violet-500",  fg: "text-violet-700 dark:text-violet-400" },
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Ödeme Dağılımı · Bugün
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">{fmtTRY(total)}</p>
        </div>
      </div>

      {/* Segmented bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mb-4">
        {data.map((s) => (
          <div
            key={s.method}
            className={cn("h-full transition-all", colors[s.method]?.bg)}
            style={{ width: `${Math.max(0.5, s.share * 100)}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {data.map((s) => (
          <div key={s.method} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", colors[s.method]?.dot)} />
              <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
            </div>
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className={cn("font-bold", colors[s.method]?.fg)}>{fmtTRY(s.amount)}</span>
              <span className="text-xs text-slate-400">%{(s.share * 100).toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
