"use client"

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts"
import { TrendingUp, Users, Clock, XCircle, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StaffMember } from "@/types/personel"

interface TooltipProps {
  active?: boolean
  payload?: { value: number; name: string }[]
  label?: string
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl border border-slate-700">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-bold text-violet-400">{payload[0]?.value} işlem</p>
    </div>
  )
}

export function PerformanceStats({ staff }: { staff: StaffMember }) {
  const cancelPct = staff.cancelRate
  const performanceScore = Math.round(100 - cancelPct * 5 + (staff.todayTxCount / 2))
  const clampedScore = Math.min(100, Math.max(0, performanceScore))

  const metrics = [
    {
      label: "Bugünkü İşlem",
      value: staff.todayTxCount,
      suffix: "adet",
      icon: Zap,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-500/10",
    },
    {
      label: "Toplam Müşteri",
      value: staff.totalCustomers,
      suffix: "kişi",
      icon: Users,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-50 dark:bg-sky-500/10",
    },
    {
      label: "Ort. İşlem Süresi",
      value: staff.avgTxMinutes,
      suffix: "dk",
      icon: Clock,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      label: "İptal Oranı",
      value: staff.cancelRate,
      suffix: "%",
      icon: XCircle,
      color: staff.cancelRate > 3 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400",
      bg: staff.cancelRate > 3 ? "bg-rose-50 dark:bg-rose-500/10" : "bg-amber-50 dark:bg-amber-500/10",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Score card */}
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm text-white/70">Performans Skoru</p>
            <p className="text-5xl font-bold tabular-nums mt-1">{clampedScore}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-xs font-semibold text-emerald-300">+5 bu hafta</span>
            </div>
          </div>
          <div className="text-right">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${clampedScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className={cn("rounded-2xl p-4", m.bg)}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("w-4 h-4", m.color)} />
                <span className="text-xs text-slate-500 dark:text-slate-400">{m.label}</span>
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", m.color)}>
                {m.value}<span className="text-sm font-normal ml-1">{m.suffix}</span>
              </p>
            </div>
          )
        })}
      </div>

      {/* Weekly chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Haftalık İşlem Trendi</p>
          <p className="text-xs text-slate-500 mt-0.5">Son 7 gün</p>
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={staff.dailyPerformance} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "currentColor" }} className="text-slate-400" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "currentColor" }} className="text-slate-400" axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="txCount" stroke="#7c3aed" strokeWidth={2} fill="url(#perfGrad)" dot={false} activeDot={{ r: 4, fill: "#7c3aed" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
