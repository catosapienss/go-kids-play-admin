"use client"

import { useEffect, useState } from "react"
import {
  Play, Sparkles, Cake, ShoppingBag, Loader2, TrendingUp, AlertCircle,
} from "lucide-react"
import { fetchDailyRevenueBreakdown, fetchRetailTodaySummary } from "@/lib/services/retail"
import type { DailyRevenueBreakdown, RetailTodaySummary } from "@/types/retail"
import { useAuth } from "@/contexts/auth-context"
import { hasModuleAccess } from "@/lib/permissions"

// ─── Owner Dashboard panels ───────────────────────────────────────────────────
//
// Two widgets the admin / manager sees on /:
//   1. Today's revenue split by source (Sessions / Memberships / Birthdays / Retail).
//   2. Top 5 selling retail products today.
//
// Gated by hasModuleAccess(user, "finance"). Manager without finance access
// gets the widgets hidden completely.

const fmt = (n: number) => `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 0 })}`

export function OwnerRevenuePanel() {
  const { user } = useAuth()
  const [breakdown, setBreakdown] = useState<DailyRevenueBreakdown | null>(null)
  const [summary,   setSummary]   = useState<RetailTodaySummary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    Promise.all([fetchDailyRevenueBreakdown(), fetchRetailTodaySummary()])
      .then(([b, s]) => {
        if (cancelled) return
        setBreakdown(b); setSummary(s)
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (!user || !hasModuleAccess(user, "finance")) return null

  const total = breakdown?.total ?? 0
  const items: { key: string; label: string; value: number; icon: React.ReactNode; color: string }[] = [
    { key: "sessions",    label: "Oyun Seansları", value: breakdown?.sessions    ?? 0, icon: <Play       className="w-3.5 h-3.5" />, color: "from-violet-500 to-purple-600" },
    { key: "memberships", label: "Üyelikler",      value: breakdown?.memberships ?? 0, icon: <Sparkles   className="w-3.5 h-3.5" />, color: "from-sky-500 to-blue-600" },
    { key: "birthdays",   label: "Doğum Günleri",  value: breakdown?.birthdays   ?? 0, icon: <Cake       className="w-3.5 h-3.5" />, color: "from-pink-500 to-rose-600" },
    { key: "retail",      label: "Perakende",      value: breakdown?.retail      ?? 0, icon: <ShoppingBag className="w-3.5 h-3.5" />, color: "from-amber-500 to-orange-600" },
  ]

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-4">
      {/* Today's revenue */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Bugünkü Gelir</p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : fmt(total)}
            </h2>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-500" />
        </div>

        {error && (
          <div className="mt-3 text-xs text-rose-500 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {items.map((it) => {
            const pct = total > 0 ? Math.round((it.value / total) * 100) : 0
            return (
              <div key={it.key} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${it.color} flex items-center justify-center text-white flex-shrink-0`}>
                  {it.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{it.label}</span>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{fmt(it.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${it.color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="w-10 text-right text-[11px] font-bold text-slate-400 tabular-nums">{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top selling products */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">En Çok Satan Ürünler</h2>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">Bugün</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          </div>
        )}

        {!loading && (!summary || summary.top_items.length === 0) && (
          <p className="text-xs text-slate-400 text-center py-8">
            Bugün henüz perakende satışı yok.
          </p>
        )}

        {!loading && summary && summary.top_items.length > 0 && (
          <ol className="space-y-2">
            {summary.top_items.map((it, idx) => (
              <li key={it.product_id} className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{it.product_name}</p>
                  <p className="text-[11px] text-slate-500">{it.qty} adet</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                  {fmt(it.revenue)}
                </p>
              </li>
            ))}
          </ol>
        )}

        {!loading && summary && summary.totals.tx_count > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>{summary.totals.tx_count} satış</span>
            <span className="font-mono tabular-nums">{fmt(summary.totals.total_revenue)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
