"use client"

import { useEffect, useState } from "react"
import {
  Users, Repeat, Crown, TrendingUp, ChevronRight, Phone,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { getCustomerInsights } from "@/lib/services/reports.service"
import { type CustomerInsights } from "@/types/reports"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"
import { CustomerProfileSheet } from "@/components/crm/customer-profile-sheet"

// ─── Customer Insights Panel ─────────────────────────────────────────────────
//
// Aggregated customer behaviour for the chosen date range:
//   • Returning rate (% of active parents who visited before this range)
//   • VIP ratio (% of all parents flagged VIP)
//   • Average spend per parent
//   • Top 10 spenders (clickable → CustomerProfileSheet)

function fmtTRY(n: number): string {
  if (Math.abs(n) >= 1000) return `₺${(n / 1000).toFixed(1).replace(".0", "")}k`
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "?"
}

export function CustomerInsightsPanel() {
  const { range } = useDateRange()
  const [data, setData] = useState<CustomerInsights | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    void getCustomerInsights(range)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [range, reconnectToken])

  if (!data && !error) return <PanelSkeleton height={400} />
  if (error)            return <EmptyState title="Müşteri verisi okunamadı" body={error} tone="danger" />
  if (!data) return null

  return (
    <>
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Müşteri İçgörüleri</h3>
        </div>

        {/* KPI grid */}
        <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Toplam Müşteri"    value={data.totalCustomers}  hint="kayıtlı veli"  icon={Users}      tone="violet" />
          <Stat label="Tekrar Gelme"      value={`%${data.returningRate.toFixed(1)}`} hint={`${data.returning}/${data.activeInRange} aile`} icon={Repeat} tone="emerald" />
          <Stat label="VIP Oranı"          value={`%${data.vipRatio.toFixed(1)}`}      hint={`${data.vipCount} VIP`}            icon={Crown}  tone="amber"   />
          <Stat label="Ortalama Harcama"  value={fmtTRY(data.avgSpend)} hint="aile başına"                            icon={TrendingUp} tone="blue" />
        </div>

        {/* Top spenders */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
              En Çok Harcayanlar
            </h4>
            <span className="text-[10px] text-slate-400">Top {data.topSpenders.length}</span>
          </div>
          {data.topSpenders.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Henüz veri yok</p>
          ) : (
            <ul className="space-y-1">
              {data.topSpenders.map((t, i) => (
                <li key={t.parentId}>
                  <button
                    type="button"
                    onClick={() => setOpenId(t.parentId)}
                    className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <span className="w-5 text-right text-[11px] font-bold tabular-nums text-slate-400 flex-shrink-0">{i + 1}</span>
                    <div className={cn(
                      "w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold flex-shrink-0",
                      t.isVip ? "from-amber-400 to-orange-500" : "from-violet-500 to-purple-600",
                    )}>
                      {initials(t.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.fullName}</p>
                        {t.isVip && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                        <Phone className="w-2.5 h-2.5" /> {t.phone}
                        <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>
                        {t.visits} ziyaret
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {fmtTRY(t.spent)}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <CustomerProfileSheet
        parentId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
      />
    </>
  )
}

// ─── KPI tile atom ───────────────────────────────────────────────────────────

const TONE: Record<string, string> = {
  violet:  "bg-violet-500/10  text-violet-600  dark:text-violet-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  amber:   "bg-amber-500/10   text-amber-600   dark:text-amber-300",
  blue:    "bg-blue-500/10    text-blue-600    dark:text-blue-300",
}

function Stat({ label, value, hint, icon: Icon, tone }: {
  label: string
  value: string | number
  hint: string
  icon: typeof Users
  tone: keyof typeof TONE
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", TONE[tone])}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{hint}</p>
    </div>
  )
}
