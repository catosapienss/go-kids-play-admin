"use client"

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import type { Customer } from "@/types/crm"

interface OverviewChartsProps {
  customer: Customer
}

const PACKAGE_COLORS: Record<string, string> = {
  "30dk": "#38bdf8",
  "60dk": "#8b5cf6",
  "90dk": "#10b981",
  "Serbest": "#f97316",
}

export function OverviewCharts({ customer }: OverviewChartsProps) {
  // Package distribution
  const pkgCount: Record<string, number> = {}
  customer.visits.forEach((v) => {
    pkgCount[v.packageType] = (pkgCount[v.packageType] ?? 0) + 1
  })
  const packageData = Object.entries(pkgCount).map(([name, count]) => ({ name, count }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
      {/* Monthly visits chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Aylık Ziyaret</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Son 6 ay</p>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={customer.monthlyStats} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`visitGrad_${customer.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "12px" }}
              formatter={(v) => [`${v} ziyaret`, ""]}
            />
            <Area type="monotone" dataKey="visits" stroke="#8b5cf6" strokeWidth={2.5} fill={`url(#visitGrad_${customer.id})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly spend chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Aylık Harcama</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Son 6 ay (₺)</p>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={customer.monthlyStats} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "12px" }}
              formatter={(v) => [`₺${v}`, "Harcama"]}
            />
            <Bar dataKey="spend" radius={[6, 6, 0, 0]} fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Package distribution */}
      {packageData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Paket Dağılımı</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kullanılan paketler</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={packageData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={45} />
              <Tooltip
                contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "12px" }}
                formatter={(v) => [`${v} kez`, ""]}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {packageData.map((entry) => (
                  <Cell key={entry.name} fill={PACKAGE_COLORS[entry.name] ?? "#8b5cf6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Payment method distribution */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Ödeme Tercihi</h3>
        <div className="space-y-3">
          {(["cash", "card", "wallet"] as const).map((method) => {
            const count = customer.visits.filter((v) => v.paymentMethod === method).length
            const pct = customer.visits.length > 0 ? Math.round((count / customer.visits.length) * 100) : 0
            const labels = { cash: "Nakit", card: "Kart", wallet: "Cüzdan" }
            const colors = { cash: "bg-emerald-500", card: "bg-blue-500", wallet: "bg-violet-500" }
            return (
              <div key={method}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{labels[method]}</span>
                  <span className="text-slate-500">{count} kez · %{pct}</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${colors[method]}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
