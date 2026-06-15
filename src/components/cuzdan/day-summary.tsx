import { Banknote, CreditCard, Wallet, ArrowDownLeft, SplitSquareVertical, TrendingUp, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DaySummary } from "@/types/cuzdan"

const ROWS = (s: DaySummary) => [
  {
    label: "Nakit Tahsilatı",
    value: s.totalCash,
    icon: Banknote,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
  },
  {
    label: "Kart Tahsilatı",
    value: s.totalCard,
    icon: CreditCard,
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-500/10",
  },
  {
    label: "Cüzdan Kullanımı",
    value: s.totalWallet,
    icon: Wallet,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-500/10",
  },
  {
    label: "Cüzdan Yüklemeleri",
    value: s.walletLoadAmount,
    icon: Wallet,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-500/10",
  },
  {
    label: "Karma Ödeme (Adet)",
    value: s.splitPaymentCount,
    icon: SplitSquareVertical,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    isCount: true,
  },
  {
    label: "İade Toplamı",
    value: s.totalRefund,
    icon: ArrowDownLeft,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    isNegative: true,
  },
]

export function DaySummaryPanel({ summary }: { summary: DaySummary }) {
  const rows = ROWS(summary)
  const gross = summary.totalCash + summary.totalCard + summary.totalWallet

  return (
    <div className="space-y-4">
      {/* Net total highlight */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-400">Gün Sonu Net Gelir</p>
              <p className="text-4xl font-bold tabular-nums mt-1">₺{summary.netRevenue.toLocaleString("tr-TR")}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">+12.4%</span>
              </div>
              <p className="text-xs text-slate-400">{summary.txCount} işlem</p>
              <p className="text-xs text-slate-400">Ort. ₺{summary.avgTxAmount}</p>
            </div>
          </div>

          {/* Gross bar */}
          <div>
            <div className="flex justify-between mb-1">
              <p className="text-xs text-slate-400">Brüt Gelir: ₺{gross.toLocaleString("tr-TR")}</p>
              <p className="text-xs text-slate-400">İade: −₺{summary.totalRefund.toLocaleString("tr-TR")}</p>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden flex gap-0.5">
              {[
                { w: Math.round((summary.totalCash / gross) * 100), c: "bg-emerald-400" },
                { w: Math.round((summary.totalCard / gross) * 100), c: "bg-sky-400" },
                { w: Math.round((summary.totalWallet / gross) * 100), c: "bg-violet-400" },
              ].map((seg, i) => (
                <div key={i} className={cn("h-full rounded-full", seg.c)} style={{ width: `${seg.w}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Detaylı Kasa Özeti</p>
          <button className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Rapor Al
          </button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => {
            const Icon = row.icon
            return (
              <div key={row.label} className="flex items-center gap-3 px-4 py-3.5">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", row.bg)}>
                  <Icon className={cn("w-4 h-4", row.color)} />
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 flex-1">{row.label}</p>
                <p className={cn("text-sm font-bold tabular-nums", row.isNegative ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white")}>
                  {row.isNegative ? "−" : ""}
                  {row.isCount ? `${row.value} adet` : `₺${row.value.toLocaleString("tr-TR")}`}
                </p>
              </div>
            )
          })}
        </div>

        {/* Net total row */}
        <div className="px-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900 dark:text-white">Net Kasa Toplamı</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            ₺{summary.netRevenue.toLocaleString("tr-TR")}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        {[
          { color: "bg-emerald-400", label: "Nakit" },
          { color: "bg-sky-400", label: "Kart" },
          { color: "bg-violet-400", label: "Cüzdan" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", l.color)} />
            <span className="text-xs text-slate-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
