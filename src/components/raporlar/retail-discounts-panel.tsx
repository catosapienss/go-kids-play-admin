"use client"

import { useEffect, useState } from "react"
import { Tag, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { listRetailDiscountLines, type RetailDiscountLine } from "@/lib/services/retail"
import { RETAIL_DISCOUNT_REASON_LABELS, type RetailDiscountReason } from "@/types/retail"

// ─── Retail Discounts Panel (reports) ────────────────────────────────────────
//
// Read-only history of every discounted / price-overridden retail line in the
// selected range. Shows original vs final price, discount ₺ + %, reason, staff,
// date & time. The product's list price is never modified — this is the audit.

function fmt(n: number): string { return "₺" + Math.round(n).toLocaleString("tr-TR") }
function fmtDT(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const pad = (n: number) => n < 10 ? "0" + n : String(n)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function reasonLabel(reason: string | null, note: string | null): string {
  if (!reason) return "—"
  const base = RETAIL_DISCOUNT_REASON_LABELS[reason as RetailDiscountReason] ?? reason
  return note ? `${base} · ${note}` : base
}
function pct(line: RetailDiscountLine): string {
  const base = line.originalUnitPrice * line.quantity
  if (base <= 0) return "—"
  return `%${Math.round((line.discountAmount / base) * 100)}`
}

export function RetailDiscountsPanel({ limit = 80 }: { limit?: number }) {
  const { range } = useDateRange()
  const [rows, setRows] = useState<RetailDiscountLine[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    listRetailDiscountLines(range.from.toISOString(), range.to.toISOString(), limit)
      .then((d) => { if (!cancelled) setRows(d) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [range.from, range.to, limit])

  const total = rows ? rows.reduce((s, r) => s + r.discountAmount, 0) : 0
  const count = rows?.length ?? 0

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Perakende İndirim Geçmişi</h2>
            <p className="text-[11px] text-slate-500">Orijinal fiyat korunur · her indirim iz bırakır</p>
          </div>
        </div>
        {rows && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Toplam · {count} kalem</p>
            <p className="text-base font-black text-amber-600 dark:text-amber-400 tabular-nums">−{fmt(total)}</p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Th>Zaman</Th>
              <Th>Ürün</Th>
              <Th>Personel</Th>
              <Th>Sebep</Th>
              <Th className="text-right">Orijinal</Th>
              <Th className="text-right">Satış</Th>
              <Th className="text-right">%</Th>
              <Th className="text-right pr-5">İndirim</Th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={8} className="py-8 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></td></tr>
            ) : count === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">Bu aralıkta perakende indirimi yok</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap text-[12.5px]">{fmtDT(r.soldAt)}</td>
                <td className="px-4 py-2 text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                  {r.productName}{r.quantity > 1 ? ` × ${r.quantity}` : ""}
                  {r.discountType === "override" && <span className="ml-1 text-[10px] font-bold text-violet-500">Manuel</span>}
                </td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.staffName ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-400 text-[12.5px] truncate max-w-[180px]">{reasonLabel(r.reason, r.note)}</td>
                <td className="px-4 py-2 text-right text-slate-400"><s>{fmt(r.originalUnitPrice)}</s></td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900 dark:text-white">{fmt(r.finalUnitPrice)}</td>
                <td className="px-4 py-2 text-right text-slate-500">{pct(r)}</td>
                <td className="px-4 py-2 pr-5 text-right font-bold text-amber-600 dark:text-amber-400">−{fmt(r.discountAmount)}</td>
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
