"use client"

import { useEffect, useState } from "react"
import { Percent, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import {
  listRecentDiscounts, DISCOUNT_REASON_LABELS,
  type DiscountRow,
} from "@/lib/services/discount.service"

// ─── Discounts Panel ────────────────────────────────────────────────────────
//
// Read-only discount history for /raporlar. Pulls from public.discounts,
// joined with profile name on `applied_by_name` (stored at write time).
// Date-scoped via the global DateRangePicker.

function fmt(n: number): string { return "₺" + Math.round(n).toLocaleString("tr-TR") }
function fmtDT(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n < 10 ? "0" + n : String(n)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function DiscountsPanel({ limit = 80 }: { limit?: number }) {
  const { range } = useDateRange()
  const [rows, setRows]   = useState<DiscountRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null); setError(null)
    listRecentDiscounts({
      fromIso: range.from.toISOString(),
      toIso:   range.to.toISOString(),
      limit,
    }).then((data) => { if (!cancelled) setRows(data) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [range.from, range.to, limit])

  const total = rows ? rows.reduce((s, r) => s + Number(r.discount_amount || 0), 0) : 0
  const count = rows?.length ?? 0

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">İndirim Geçmişi</h2>
            <p className="text-[11px] text-slate-500">Seçili aralıkta uygulanan tüm indirimler</p>
          </div>
        </div>
        {rows && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Toplam · {count} kayıt</p>
            <p className="text-base font-black text-amber-600 dark:text-amber-400 tabular-nums">{fmt(total)}</p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Th>Zaman</Th>
              <Th>Personel</Th>
              <Th>Sebep</Th>
              <Th className="text-right">Oran/Değer</Th>
              <Th className="text-right pr-5">Tutar</Th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error ? (
              <tr><td colSpan={5} className="py-8 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></td></tr>
            ) : error ? (
              <tr><td colSpan={5} className="py-8 text-center text-rose-500 text-sm">{error}</td></tr>
            ) : count === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm">Bu aralıkta indirim yok</td></tr>
            ) : rows!.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap text-[12.5px]">{fmtDT(r.created_at)}</td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.applied_by_name ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-400 text-[12.5px]">
                  {r.reason ? (DISCOUNT_REASON_LABELS[r.reason as keyof typeof DISCOUNT_REASON_LABELS] ?? r.reason) : "—"}
                </td>
                <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">
                  {r.discount_type === "percent"
                    ? `%${Number(r.discount_value).toLocaleString("tr-TR")}`
                    : fmt(Number(r.discount_value))}
                </td>
                <td className={cn("px-4 py-2 pr-5 text-right font-bold text-amber-600 dark:text-amber-400")}>
                  −{fmt(Number(r.discount_amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2 font-bold whitespace-nowrap", className)}>{children}</th>
}
