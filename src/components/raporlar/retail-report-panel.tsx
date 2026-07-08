"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts"
import { ShoppingBag, Loader2 } from "lucide-react"
import { cn, formatTRY, formatNumberTR } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { fetchRetailReport, type RetailReport } from "@/lib/services/retail"

// ─── Reports · Retail (Perakende) ────────────────────────────────────────────
//
// Refined, minimal retail analytics for the selected range. One accented hero
// figure, calm neutral stat cells, a soft daily-revenue area, and a clean
// "what sold" list. The global date picker drives daily / weekly / monthly.

function AreaTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; revenue: number; count: number } }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-slate-900 dark:text-white tabular-nums">{formatTRY(p.revenue)}</p>
      <p className="text-slate-400 mt-0.5">{p.label} · {p.count} satış</p>
    </div>
  )
}

export function RetailReportPanel() {
  const { range } = useDateRange()
  const [data, setData] = useState<RetailReport | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    fetchRetailReport(range.from.toISOString(), range.to.toISOString())
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [range.from, range.to])

  const avgBasket = data && data.saleCount > 0 ? data.totalRevenue / data.saleCount : 0
  const maxQty = data ? Math.max(1, ...data.topProducts.map((p) => p.qty)) : 1

  return (
    <div className="space-y-6">
      {/* Hero + secondary stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Accented hero — the one number that matters most */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white p-6 flex flex-col justify-between min-h-[168px]">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-white/70">Perakende Ciro</span>
            <ShoppingBag className="w-4 h-4 text-white/60" />
          </div>
          <div className="relative">
            <p className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">
              {data ? formatTRY(data.totalRevenue) : <span className="inline-block w-40 h-9 bg-white/20 rounded-lg animate-pulse" />}
            </p>
            <p className="text-xs text-white/60 mt-2">
              {data ? `${data.saleCount} satış · ${formatNumberTR(data.itemsSold)} ürün` : ""}
            </p>
          </div>
        </div>

        {/* Calm neutral stat grid */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label="Nakit"        value={data ? formatTRY(data.cashTotal) : undefined} accent="emerald" />
          <Stat label="Kart"         value={data ? formatTRY(data.cardTotal) : undefined} accent="sky" />
          <Stat label="İndirim"      value={data ? formatTRY(data.discountTotal) : undefined} accent="amber" />
          <Stat label="Satılan Ürün" value={data ? `${formatNumberTR(data.itemsSold)}` : undefined} sub="adet" />
          <Stat label="Satış Sayısı" value={data ? `${data.saleCount}` : undefined} sub="işlem" />
          <Stat label="Ort. Sepet"   value={data ? formatTRY(avgBasket) : undefined} />
        </div>
      </div>

      {/* Daily revenue — soft area */}
      <div className="rounded-3xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-6">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Günlük Perakende Cirosu</h3>
          <p className="text-xs text-slate-400 mt-0.5">Seçili dönemdeki günlük satış tutarı</p>
        </div>
        {data === null ? (
          <div className="h-[220px] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
        ) : data.daily.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">Bu aralıkta perakende satışı yok</div>
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={data.daily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="retailArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-100 dark:text-slate-800/70" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} dy={6} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => formatTRY(Number(v))} />
              <Tooltip content={<AreaTip />} cursor={{ stroke: "#c4b5fd", strokeWidth: 1 }} />
              <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2.5} fill="url(#retailArea)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#7c3aed" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* What was sold */}
      <div className="rounded-3xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ne Satıldı</h3>
          <p className="text-xs text-slate-400 mt-0.5">Seçili dönemde en çok satan ürünler</p>
        </div>
        {data === null ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>
        ) : data.topProducts.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Ürün satışı yok</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {data.topProducts.map((p, i) => (
              <li key={p.name} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <span className={cn(
                  "w-6 text-center text-xs font-semibold tabular-nums flex-shrink-0",
                  i === 0 ? "text-violet-600 dark:text-violet-400" : "text-slate-300 dark:text-slate-600",
                )}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-400/70 dark:bg-violet-500/60" style={{ width: `${Math.max(4, (p.qty / maxQty) * 100)}%` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400 w-16 text-right flex-shrink-0">{formatNumberTR(p.qty)} adet</span>
                <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white w-24 text-right flex-shrink-0">{formatTRY(p.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Calm neutral stat cell ──────────────────────────────────────────────────

function Stat({ label, value, sub, accent }: {
  label: string; value: string | undefined; sub?: string
  accent?: "emerald" | "sky" | "amber"
}) {
  const dot = accent === "emerald" ? "bg-emerald-500"
    : accent === "sky" ? "bg-sky-500"
    : accent === "amber" ? "bg-amber-500"
    : null
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between">
      <div className="flex items-center gap-1.5">
        {dot && <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />}
        <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400 font-medium">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
        {value ?? <span className="inline-block w-16 h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />}
        {value && sub && <span className="text-sm font-normal text-slate-400 ml-1">{sub}</span>}
      </p>
    </div>
  )
}
