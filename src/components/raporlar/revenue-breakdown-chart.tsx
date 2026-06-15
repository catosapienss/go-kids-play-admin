"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"
import { TrendingUp, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { getRevenueBreakdown, downloadCsv } from "@/lib/services/reports.service"
import { type RevenueDayPoint } from "@/types/reports"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"

// ─── Revenue Breakdown Chart ──────────────────────────────────────────────────
//
// Stacked area: cash / card / wallet over time. Refunds drawn as a thin
// outlined area so you can see *exactly* where money went and where it came
// back. Date-range-aware via the global DateRangeProvider.

function fmtTRY(n: number): string {
  if (Math.abs(n) >= 1000) return `₺${(n / 1000).toFixed(1).replace(".0", "")}k`
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

export function RevenueBreakdownChart() {
  const { range } = useDateRange()
  const [data, setData] = useState<RevenueDayPoint[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    void getRevenueBreakdown(range)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [range, reconnectToken])

  const totals = useMemo(() => {
    if (!data) return null
    return data.reduce(
      (acc, d) => ({
        cash:    acc.cash    + d.cash,
        card:    acc.card    + d.card,
        wallet:  acc.wallet  + d.wallet,
        gross:   acc.gross   + d.gross,
        refunds: acc.refunds + d.refunds,
        net:     acc.net     + d.net,
      }),
      { cash: 0, card: 0, wallet: 0, gross: 0, refunds: 0, net: 0 },
    )
  }, [data])

  function handleExport() {
    if (!data) return
    downloadCsv(`gelir-${range.from.toISOString().slice(0, 10)}.csv`, data.map((d) => ({
      Tarih: d.iso,
      Nakit: d.cash,
      Kart: d.card,
      Cuzdan: d.wallet,
      Brut: d.gross,
      Iade: d.refunds,
      Net: d.net,
      Islem: d.txCount,
    })))
  }

  if (!data && !error) return <PanelSkeleton height={320} />
  if (error)             return <EmptyState title="Gelir verisi okunamadı" body={error} tone="danger" />
  if (!data || data.length === 0) return <EmptyState title="Bu aralıkta gelir kaydı yok" />

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Gelir Dağılımı</p>
          </div>
          <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white mt-1">
            {fmtTRY(totals!.net)}
          </p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />Nakit {fmtTRY(totals!.cash)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />Kart {fmtTRY(totals!.card)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-500" />Cüzdan {fmtTRY(totals!.wallet)}
            </span>
            {totals!.refunds > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />İade {fmtTRY(totals!.refunds)}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold",
            "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
            "transition-colors",
          )}
        >
          <Download className="w-3 h-3" /> CSV
        </button>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="cashGrad"   x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
            <linearGradient id="cardGrad"   x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
            <linearGradient id="walletGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtTRY(Number(v))} />
          <Tooltip
            contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: 12 }}
            labelStyle={{ fontWeight: 700 }}
            formatter={(v, name) => [fmtTRY(Number(v)), name === "cash" ? "Nakit" : name === "card" ? "Kart" : name === "wallet" ? "Cüzdan" : name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="circle"
            iconSize={8}
            formatter={(value) => value === "cash" ? "Nakit" : value === "card" ? "Kart" : value === "wallet" ? "Cüzdan" : value}
          />
          <Area type="monotone" dataKey="cash"   stackId="1" stroke="#10b981" strokeWidth={1.5} fill="url(#cashGrad)" />
          <Area type="monotone" dataKey="card"   stackId="1" stroke="#3b82f6" strokeWidth={1.5} fill="url(#cardGrad)" />
          <Area type="monotone" dataKey="wallet" stackId="1" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#walletGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
