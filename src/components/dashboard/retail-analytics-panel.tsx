"use client"

import { useEffect, useState } from "react"
import { ShoppingBag, Tag, Users, Megaphone, Loader2 } from "lucide-react"
import { cn, formatTRY } from "@/lib/utils"
import { fetchRetailDiscountBreakdown, type RetailDiscountBreakdown } from "@/lib/services/retail"

// ─── Dashboard · Retail Analytics ────────────────────────────────────────────
//
// Management view of today's retail performance: gross retail sales plus how
// much was given away in discounts, split by category (staff vs promotional vs
// other). Read-only; tolerant of the pre-021 schema (discounts read as 0).

function todayStartIso(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString()
}

export function RetailAnalyticsPanel() {
  const [data, setData] = useState<RetailDiscountBreakdown | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => fetchRetailDiscountBreakdown(todayStartIso(), new Date().toISOString())
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { /* best-effort */ })
    void load()
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <ShoppingBag className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Perakende Analitiği · Bugün
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {data ? `${data.saleCount} satış · ${data.discountedLines} indirimli kalem` : "Yükleniyor…"}
          </p>
        </div>
      </div>

      {!data ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Perakende Satış"    value={formatTRY(data.totalSales)}        icon={ShoppingBag} tone="emerald" emphasis />
          <Metric label="Perakende İndirim"  value={formatTRY(data.totalDiscount)}     icon={Tag}         tone="amber" />
          <Metric label="Personel İndirimi"  value={formatTRY(data.staffDiscount)}     icon={Users}       tone="violet" />
          <Metric label="Promosyon İndirimi" value={formatTRY(data.promotionDiscount)} icon={Megaphone}   tone="sky" />
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, icon: Icon, tone, emphasis }: {
  label: string; value: string; icon: typeof Tag
  tone: "emerald" | "amber" | "violet" | "sky"; emphasis?: boolean
}) {
  const tones: Record<typeof tone, { bg: string; fg: string }> = {
    emerald: { bg: "bg-emerald-100 dark:bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-300" },
    amber:   { bg: "bg-amber-100   dark:bg-amber-500/10",   fg: "text-amber-600   dark:text-amber-300" },
    violet:  { bg: "bg-violet-100  dark:bg-violet-500/10",  fg: "text-violet-600  dark:text-violet-300" },
    sky:     { bg: "bg-sky-100     dark:bg-sky-500/10",     fg: "text-sky-600     dark:text-sky-300" },
  }
  return (
    <div className={cn(
      "rounded-xl border p-3",
      emphasis ? "border-emerald-300/60 dark:border-emerald-500/30" : "border-slate-200/70 dark:border-slate-800/70",
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", tones[tone].bg)}>
          <Icon className={cn("w-3.5 h-3.5", tones[tone].fg)} />
        </div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
      </div>
      <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}
