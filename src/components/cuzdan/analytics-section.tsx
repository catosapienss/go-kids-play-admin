"use client"

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import { cn, formatNumberTR } from "@/lib/utils"
import type { HourlyData, WeeklyData, DaySummary } from "@/types/cuzdan"

interface TooltipProps {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl border border-slate-700">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          ₺{p.value.toLocaleString("tr-TR")}
        </p>
      ))}
    </div>
  )
}

function WeeklyTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl border border-slate-700">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-bold text-violet-400">₺{payload[0]?.value.toLocaleString("tr-TR")}</p>
    </div>
  )
}

interface AnalyticsSectionProps {
  hourlyData: HourlyData[]
  weeklyData: WeeklyData[]
  summary: DaySummary
}

export function AnalyticsSection({ hourlyData, weeklyData, summary }: AnalyticsSectionProps) {
  const gross = summary.totalCash + summary.totalCard + summary.totalWallet
  const paymentSplit = [
    { label: "Nakit", value: summary.totalCash, pct: Math.round((summary.totalCash / gross) * 100), color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
    { label: "Kart", value: summary.totalCard, pct: Math.round((summary.totalCard / gross) * 100), color: "bg-sky-500", textColor: "text-sky-600 dark:text-sky-400" },
    { label: "Cüzdan", value: summary.totalWallet, pct: Math.round((summary.totalWallet / gross) * 100), color: "bg-violet-500", textColor: "text-violet-600 dark:text-violet-400" },
  ]

  return (
    <div className="space-y-4">
      {/* Weekly revenue trend */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Haftalık Gelir Trendi</p>
          <p className="text-xs text-slate-500 mt-0.5">Son 7 gün</p>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={weeklyData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-400" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-400" axisLine={false} tickLine={false} width={70} tickFormatter={(v) => `₺${formatNumberTR(Math.round(Number(v)))}`} />
            <Tooltip content={<WeeklyTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} fill="url(#weeklyGrad)" dot={false} activeDot={{ r: 4, fill: "#7c3aed" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly breakdown */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Saatlik Dağılım</p>
          <p className="text-xs text-slate-500 mt-0.5">Bugün — Nakit / Kart / Cüzdan</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={hourlyData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barSize={8} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "currentColor" }} className="text-slate-400" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "currentColor" }} className="text-slate-400" axisLine={false} tickLine={false} tickFormatter={(v) => `₺${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="cash" stackId="a" fill="#10b981" radius={[0, 0, 3, 3]} name="Nakit" />
            <Bar dataKey="card" stackId="a" fill="#0ea5e9" name="Kart" />
            <Bar dataKey="wallet" stackId="a" fill="#7c3aed" radius={[3, 3, 0, 0]} name="Cüzdan" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 justify-center">
          {[
            { color: "bg-emerald-500", label: "Nakit" },
            { color: "bg-sky-500", label: "Kart" },
            { color: "bg-violet-500", label: "Cüzdan" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-sm", l.color)} />
              <span className="text-xs text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment method split */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Ödeme Tipi Dağılımı</p>
        <div className="space-y-3">
          {paymentSplit.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-bold tabular-nums", item.textColor)}>₺{item.value.toLocaleString("tr-TR")}</span>
                  <span className="text-[10px] text-slate-400 w-7 text-right">{item.pct}%</span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", item.color)}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
