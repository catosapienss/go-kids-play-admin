"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts"
import {
  ShoppingBag, Banknote, CreditCard, PackageCheck, ReceiptText, Tag, Loader2, Trophy,
} from "lucide-react"
import { cn, formatTRY, formatNumberTR } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { fetchRetailReport, type RetailReport } from "@/lib/services/retail"

// ─── Reports · Retail (Perakende) ────────────────────────────────────────────
//
// Dedicated retail analytics for the selected date range (the global picker
// drives daily / weekly / monthly). Shows revenue KPIs, a daily revenue trend,
// and WHAT was sold (top products). Read-only.

function RetailTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; revenue: number; count: number } }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-slate-900 dark:text-white">{p.label}</p>
      <p className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{formatTRY(p.revenue)}</p>
      <p className="text-slate-500">{p.count} satış</p>
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

  const maxRev = data ? Math.max(1, ...data.daily.map((d) => d.revenue)) : 1

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Perakende Ciro" value={data ? formatTRY(data.totalRevenue) : undefined} icon={ShoppingBag} tone="violet" emphasis />
        <Kpi label="Nakit"          value={data ? formatTRY(data.cashTotal) : undefined}    icon={Banknote}    tone="emerald" />
        <Kpi label="Kart"           value={data ? formatTRY(data.cardTotal) : undefined}    icon={CreditCard}  tone="sky" />
        <Kpi label="Satılan Ürün"   value={data ? `${formatNumberTR(data.itemsSold)} adet` : undefined} icon={PackageCheck} tone="amber" />
        <Kpi label="Satış Sayısı"   value={data ? `${data.saleCount} işlem` : undefined}    icon={ReceiptText} tone="slate" />
        <Kpi label="İndirim"        value={data ? formatTRY(data.discountTotal) : undefined} icon={Tag}        tone="rose" />
      </div>

      {/* Daily revenue trend */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Günlük Perakende Cirosu</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">Seçili dönemdeki günlük satış tutarı</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>
        {data === null ? (
          <div className="h-[220px] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : data.daily.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">Bu aralıkta perakende satışı yok</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.daily} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => formatTRY(Number(v))} />
              <Tooltip content={<RetailTooltip />} cursor={{ fill: "rgba(139,92,246,0.08)" }} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.daily.map((d) => (
                  <Cell key={d.date} fill={d.revenue >= maxRev * 0.66 ? "#7c3aed" : "#a78bfa"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* What was sold — top products */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Ne Satıldı · En Çok Satan Ürünler</h2>
            <p className="text-[11px] text-slate-500">Seçili dönemde adet ve ciro</p>
          </div>
        </div>
        {data === null ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
        ) : data.topProducts.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Ürün satışı yok</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2 font-bold">Ürün</th>
                <th className="px-5 py-2 font-bold text-right">Adet</th>
                <th className="px-5 py-2 font-bold text-right pr-5">Ciro</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((p, i) => (
                <tr key={p.name} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-2 text-slate-800 dark:text-slate-200 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0",
                        i === 0 ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500",
                      )}>{i + 1}</span>
                      {p.name}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-right font-bold text-slate-900 dark:text-white">{formatNumberTR(p.qty)}</td>
                  <td className="px-5 py-2 pr-5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatTRY(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, icon: Icon, tone, emphasis }: {
  label: string; value: string | undefined; icon: typeof ShoppingBag
  tone: "violet" | "emerald" | "sky" | "amber" | "slate" | "rose"; emphasis?: boolean
}) {
  const tones: Record<typeof tone, { bg: string; fg: string }> = {
    violet:  { bg: "bg-violet-100  dark:bg-violet-500/10",  fg: "text-violet-600  dark:text-violet-300" },
    emerald: { bg: "bg-emerald-100 dark:bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-300" },
    sky:     { bg: "bg-sky-100     dark:bg-sky-500/10",     fg: "text-sky-600     dark:text-sky-300" },
    amber:   { bg: "bg-amber-100   dark:bg-amber-500/10",   fg: "text-amber-600   dark:text-amber-300" },
    slate:   { bg: "bg-slate-100   dark:bg-slate-800",      fg: "text-slate-600   dark:text-slate-300" },
    rose:    { bg: "bg-rose-100    dark:bg-rose-500/10",    fg: "text-rose-600    dark:text-rose-300" },
  }
  return (
    <div className={cn(
      "rounded-2xl border bg-white dark:bg-slate-900 p-3",
      emphasis ? "border-violet-300 dark:border-violet-500/40 shadow-sm shadow-violet-500/10" : "border-slate-200 dark:border-slate-800",
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", tones[tone].bg)}>
          <Icon className={cn("w-3.5 h-3.5", tones[tone].fg)} />
        </div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
      </div>
      <p className="text-lg font-black tabular-nums text-slate-900 dark:text-white">
        {value ?? <span className="inline-block w-14 h-5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />}
      </p>
    </div>
  )
}
