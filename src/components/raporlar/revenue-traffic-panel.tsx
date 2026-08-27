"use client"

import { useEffect, useMemo, useState } from "react"
import { GitCompareArrows } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTRY, formatNumberTR } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { getDailyTrafficRevenue, type DailyTrafficRevenue } from "@/lib/services/reports.service"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"

// ─── Revenue vs Traffic (Reports) ────────────────────────────────────────────
//
// Per TR-local day: child entries, playground revenue, retail revenue and
// revenue-per-child — so the owner can tell a busy-cheap day from a quiet-rich
// one. Full ₺ formatting, never abbreviated.

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", weekday: "short" }) }
  catch { return iso }
}

type DayRow = DailyTrafficRevenue & { total: number; perChild: number }

export function RevenueTrafficPanel() {
  const { range } = useDateRange()
  const [rows, setRows] = useState<DailyTrafficRevenue[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setRows(null); setError(null)
    void getDailyTrafficRevenue(range)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [range, reconnectToken])

  const { days, totals, maxTotal, maxChildren } = useMemo(() => {
    const src = (rows ?? []).filter((d) => d.childEntries > 0 || d.playgroundRevenue > 0 || d.retailRevenue > 0)
    const days: DayRow[] = src.map((d) => {
      const total = d.playgroundRevenue + d.retailRevenue
      return { ...d, total, perChild: d.childEntries > 0 ? total / d.childEntries : 0 }
    })
    const totals = days.reduce((a, d) => ({
      children: a.children + d.childEntries,
      play: a.play + d.playgroundRevenue,
      retail: a.retail + d.retailRevenue,
      total: a.total + d.total,
    }), { children: 0, play: 0, retail: 0, total: 0 })
    return {
      days,
      totals,
      maxTotal: Math.max(1, ...days.map((d) => d.total)),
      maxChildren: Math.max(1, ...days.map((d) => d.childEntries)),
    }
  }, [rows])

  if (!rows && !error) return <PanelSkeleton height={420} />
  if (error) return <EmptyState title="Gelir/trafik verisi okunamadı" body={error} tone="danger" />

  const revPerChild = totals.children > 0 ? totals.total / totals.children : 0
  const retailPerChild = totals.children > 0 ? totals.retail / totals.children : 0

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <GitCompareArrows className="w-3.5 h-3.5 text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Gelir ↔ Trafik</h3>
        <span className="text-[10px] text-slate-400 ml-auto">Çocuk başına gelir · günlük</span>
      </div>

      {/* Summary */}
      <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-slate-100 dark:border-slate-800">
        <Sum label="Toplam Çocuk" value={formatNumberTR(totals.children)} />
        <Sum label="Oyun Alanı Geliri" value={formatTRY(totals.play)} tone="emerald" />
        <Sum label="Perakende Geliri" value={formatTRY(totals.retail)} tone="amber" />
        <Sum label="Çocuk Başına Gelir" value={formatTRY(revPerChild)} tone="indigo" sub={`perakende ${formatTRY(retailPerChild)}`} />
      </div>

      {/* Per-day rows */}
      {days.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-8">Bu aralıkta veri yok</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="text-left font-bold px-4 py-2">Gün</th>
                <th className="text-right font-bold px-3 py-2">Çocuk</th>
                <th className="text-right font-bold px-3 py-2">Oyun Alanı</th>
                <th className="text-right font-bold px-3 py-2">Perakende</th>
                <th className="text-right font-bold px-3 py-2">Toplam</th>
                <th className="text-right font-bold px-3 py-2">Çocuk Başına</th>
                <th className="text-left font-bold px-3 py-2 w-40">Trafik ↔ Gelir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {days.map((d) => (
                <tr key={d.day} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-2 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{fmtDate(d.day)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-sky-600 dark:text-sky-400 font-bold">{formatNumberTR(d.childEntries)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatTRY(d.playgroundRevenue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatTRY(d.retailRevenue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900 dark:text-white">{formatTRY(d.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold">{formatTRY(d.perChild)}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full bg-sky-100 dark:bg-sky-950/40 overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(d.childEntries / maxChildren) * 100}%` }} />
                      </div>
                      <div className="h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full" style={{ width: `${(d.total / maxTotal) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-5 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> Çocuk trafiği</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Toplam gelir</span>
      </div>
    </div>
  )
}

function Sum({ label, value, tone, sub }: { label: string; value: string; tone?: "emerald" | "amber" | "indigo"; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-3">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn("text-lg font-black tabular-nums mt-0.5",
        tone === "emerald" ? "text-emerald-600 dark:text-emerald-400"
        : tone === "amber" ? "text-amber-600 dark:text-amber-400"
        : tone === "indigo" ? "text-indigo-600 dark:text-indigo-400"
        : "text-slate-900 dark:text-white")}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}
