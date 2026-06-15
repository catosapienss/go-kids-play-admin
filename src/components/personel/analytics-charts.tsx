"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts"
import type { StaffMember } from "@/types/personel"

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
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

interface AnalyticsChartsProps {
  staff: StaffMember[]
}

export function AnalyticsCharts({ staff }: AnalyticsChartsProps) {
  // Performance comparison data
  const comparisonData = staff.map((s) => ({
    name: s.name.split(" ")[0],
    "İşlem": s.todayTxCount,
    "İptal": s.todayCancelCount,
    "Müşteri": Math.round(s.totalCustomers / 30),
  }))

  // Weekly combined data
  const weeklyData = staff[0].dailyPerformance.map((d, i) => ({
    day: d.day,
    ...Object.fromEntries(staff.map((s) => [s.name.split(" ")[0], s.dailyPerformance[i].txCount])),
  }))

  const STAFF_COLORS = ["#6d28d9", "#0ea5e9", "#10b981", "#f59e0b"]

  return (
    <div className="space-y-4">
      {/* Today comparison */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Bugünkü Karşılaştırma</p>
          <p className="text-xs text-slate-500 mt-0.5">Personel bazlı işlem analizi</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={comparisonData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barSize={14} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-400" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-400" axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="İşlem" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            <Bar dataKey="İptal" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly per-staff */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Haftalık İşlem Trendi</p>
          <p className="text-xs text-slate-500 mt-0.5">Personel bazlı son 7 gün</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barSize={8} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "currentColor" }} className="text-slate-400" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "currentColor" }} className="text-slate-400" axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {staff.map((s, i) => (
              <Bar key={s.id} dataKey={s.name.split(" ")[0]} fill={STAFF_COLORS[i]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Performance table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Performans Karşılaştırma</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {staff.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: STAFF_COLORS[i] }}
              />
              <p className="text-sm font-medium text-slate-900 dark:text-white flex-1">{s.name}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="tabular-nums"><span className="font-bold text-slate-900 dark:text-white">{s.todayTxCount}</span> işlem</span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">₺{s.todayRevenue.toLocaleString("tr-TR")}</span>
                <span className={`tabular-nums ${s.cancelRate > 3 ? "text-rose-500" : "text-slate-400"}`}>%{s.cancelRate} iptal</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
