"use client"

import { useEffect, useState } from "react"
import { PackageX, Loader2 } from "lucide-react"
import { cn, formatTRY, formatNumberTR } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { fetchWasteReport } from "@/lib/services/retail-waste.service"
import { WASTE_REASON_LABELS, type WasteReport } from "@/types/retail-waste"

// ─── Reports · Zayiat (retail loss) ──────────────────────────────────────────
//
// Loss overview for the selected range: total value & quantity, split by reason,
// and the products with the most loss. Matches the minimal report language.

export function WasteReportPanel() {
  const { range } = useDateRange()
  const [data, setData] = useState<WasteReport | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    fetchWasteReport(range.from.toISOString(), range.to.toISOString())
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [range.from, range.to])

  const maxReasonCost = data ? Math.max(1, ...data.byReason.map((r) => r.cost)) : 1

  return (
    <div className="rounded-3xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <PackageX className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Zayiat (Fire / Kayıp)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Seçili dönemde satılamayan ürün kaybı</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Toplam Kayıp</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
            {data ? `−${formatTRY(data.totalCost)}` : "…"}
          </p>
        </div>
      </div>

      {data === null ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : data.entryCount === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Bu aralıkta zayiat kaydı yok</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* By reason */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-3">Sebebe Göre</p>
            <ul className="space-y-2.5">
              {data.byReason.map((r) => (
                <li key={r.reason}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 dark:text-slate-200 font-medium">{WASTE_REASON_LABELS[r.reason]}</span>
                    <span className="tabular-nums text-slate-500">
                      <span className="text-slate-400">{formatNumberTR(r.qty)} adet · </span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">−{formatTRY(r.cost)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-rose-400/70 dark:bg-rose-500/60" style={{ width: `${Math.max(4, (r.cost / maxReasonCost) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Top products */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-3">En Çok Kaybedilen Ürünler</p>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {data.topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <span className={cn("w-5 text-center text-xs font-semibold tabular-nums flex-shrink-0", i === 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-300 dark:text-slate-600")}>{i + 1}</span>
                  <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{p.name}</span>
                  <span className="text-sm tabular-nums text-slate-400 w-16 text-right">{formatNumberTR(p.qty)} adet</span>
                  <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400 w-20 text-right">−{formatTRY(p.cost)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
