"use client"

import { useEffect, useState } from "react"
import { Cake, TrendingUp, Calendar, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { getOrganizationAnalytics } from "@/lib/services/reports.service"
import { getBirthdayBreakdown, type BirthdayBreakdown } from "@/lib/services/organizations.service"
import { type OrgAnalytics } from "@/types/reports"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"

// ─── Organization Analytics Panel ─────────────────────────────────────────────
//
// Birthday + organization rollup for the chosen range. Surface the busy-day
// histogram so the manager can spot weekend / holiday concentration.

function fmtTRY(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", weekday: "short" })
  } catch { return iso }
}

export function OrgAnalyticsPanel() {
  const { range } = useDateRange()
  const [data, setData] = useState<OrgAnalytics | null>(null)
  const [breakdown, setBreakdown] = useState<BirthdayBreakdown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    void getOrganizationAnalytics(range)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    // Additive v2 breakdown (standard/premium, weekday/weekend, extras) — best
    // effort, never blocks the main panel.
    void getBirthdayBreakdown(range)
      .then((b) => { if (!cancelled) setBreakdown(b) })
      .catch(() => { if (!cancelled) setBreakdown(null) })
    return () => { cancelled = true }
  }, [range, reconnectToken])

  if (!data && !error) return <PanelSkeleton height={320} />
  if (error)            return <EmptyState title="Organizasyon verisi okunamadı" body={error} tone="danger" />
  if (!data) return null

  const busyMax = Math.max(1, ...data.busyDays.map((d) => d.count))

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Cake className="w-3.5 h-3.5 text-pink-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Organizasyon Analitiği</h3>
        {data.upcoming > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 ml-auto">
            {data.upcoming} yaklaşan
          </span>
        )}
      </div>

      {/* KPI grid */}
      <div className="p-5 grid grid-cols-2 lg:grid-cols-3 gap-3 border-b border-slate-100 dark:border-slate-800">
        <Stat label="Etkinlik"      value={data.count.toLocaleString("tr-TR")}     hint="aralıkta düzenlenen" icon={Calendar}    tone="pink" />
        <Stat label="Ort. Çocuk"    value={data.avgChildren.toFixed(1)}            hint="etkinlik başına"     icon={Users}       tone="violet" />
        <Stat label="Toplam Gelir"  value={fmtTRY(data.revenue)}                   hint="paketler dahil"      icon={TrendingUp}  tone="emerald" />
      </div>

      {/* v2 package breakdown — standard/premium + weekday/weekend + extras */}
      {breakdown && breakdown.count > 0 && (
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
            Paket Dağılımı
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Standart" count={breakdown.standardCount} value={fmtTRY(breakdown.standardRevenue)} tone="slate" />
            <MiniStat label="Premium" count={breakdown.premiumCount} value={fmtTRY(breakdown.premiumRevenue)} tone="violet" />
            <MiniStat label="Hafta İçi" value={fmtTRY(breakdown.weekdayRevenue)} tone="sky" />
            <MiniStat label="Hafta Sonu" value={fmtTRY(breakdown.weekendRevenue)} tone="amber" />
            <MiniStat label="Ek Hizmet" value={fmtTRY(breakdown.extrasRevenue)} tone="emerald" />
            <MiniStat label="Ek Misafir" value={fmtTRY(breakdown.extraGuestRevenue)} tone="emerald" />
          </div>
          {breakdown.legacyRevenue > 0 && (
            <p className="text-[10px] text-slate-400">
              Eski paketler (v2 öncesi): {fmtTRY(breakdown.legacyRevenue)} — tarihsel kayıtlar değiştirilmedi.
            </p>
          )}
        </div>
      )}

      {/* Busy days */}
      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
            En Yoğun Günler
          </h4>
          <span className="text-[10px] text-slate-400">Top {data.busyDays.length}</span>
        </div>

        {data.busyDays.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Bu aralıkta etkinlik yok</p>
        ) : (
          <ul className="space-y-2">
            {data.busyDays.map((d) => (
              <li key={d.date} className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 w-20 flex-shrink-0">
                  {fmtDate(d.date)}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-fuchsia-500 rounded-full"
                    style={{ width: `${(d.count / busyMax) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200 w-8 text-right">
                  {d.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── KPI tile atom ───────────────────────────────────────────────────────────

const TONE: Record<string, string> = {
  pink:    "bg-pink-500/10    text-pink-600    dark:text-pink-300",
  violet:  "bg-violet-500/10  text-violet-600  dark:text-violet-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
}

function Stat({ label, value, hint, icon: Icon, tone }: {
  label: string
  value: string
  hint: string
  icon: typeof Calendar
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
      <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{hint}</p>
    </div>
  )
}

// ─── Compact breakdown tile ──────────────────────────────────────────────────

function MiniStat({ label, value, count, tone }: {
  label: string; value: string; count?: number; tone: keyof typeof TONE | "slate" | "sky" | "amber"
}) {
  const toneCls =
    tone === "slate" ? "text-slate-600 dark:text-slate-300"
    : tone === "sky" ? "text-sky-600 dark:text-sky-300"
    : tone === "amber" ? "text-amber-600 dark:text-amber-300"
    : tone === "violet" ? "text-violet-600 dark:text-violet-300"
    : "text-emerald-600 dark:text-emerald-300"
  return (
    <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 px-3 py-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
        {count != null && <span className="text-[10px] font-bold text-slate-400 tabular-nums">{count}</span>}
      </div>
      <p className={cn("text-sm font-bold tabular-nums mt-0.5", toneCls)}>{value}</p>
    </div>
  )
}
