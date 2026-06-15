import { TrendingUp, Banknote, CreditCard, Wallet, ArrowDownLeft, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DaySummary } from "@/types/cuzdan"

const STAT_CARDS = (s: DaySummary) => [
  {
    label: "Nakit",
    value: s.totalCash,
    icon: Banknote,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/25",
  },
  {
    label: "Kart",
    value: s.totalCard,
    icon: CreditCard,
    color: "text-sky-400",
    bg: "bg-sky-500/15",
    border: "border-sky-500/25",
  },
  {
    label: "Cüzdan",
    value: s.totalWallet,
    icon: Wallet,
    color: "text-violet-400",
    bg: "bg-violet-500/15",
    border: "border-violet-500/25",
  },
  {
    label: "İade",
    value: s.totalRefund,
    icon: ArrowDownLeft,
    color: "text-rose-400",
    bg: "bg-rose-500/15",
    border: "border-rose-500/25",
  },
]

export function StatsHero({ summary }: { summary: DaySummary }) {
  const cards = STAT_CARDS(summary)

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-violet-950 rounded-3xl p-6 overflow-hidden relative">
      {/* BG decorations */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/10 rounded-full translate-y-20 -translate-x-20 blur-3xl pointer-events-none" />

      {/* Main revenue */}
      <div className="relative mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">Bugünkü Net Gelir</p>
            <p className="text-4xl font-bold text-white tabular-nums">
              ₺{summary.netRevenue.toLocaleString("tr-TR")}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">+12.4%</span>
              </div>
              <span className="text-xs text-slate-500">dünden</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <Receipt className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">İşlem Sayısı</span>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">{summary.txCount}</p>
            <p className="text-xs text-slate-500 mt-1">Ort. ₺{summary.avgTxAmount.toLocaleString("tr-TR")}</p>
          </div>
        </div>

        {/* Gross breakdown bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-500">Brüt Gelir Dağılımı</p>
            <p className="text-xs text-slate-400 tabular-nums">₺{(summary.totalCash + summary.totalCard + summary.totalWallet).toLocaleString("tr-TR")}</p>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden flex gap-0.5">
            {[
              { pct: Math.round((summary.totalCash / (summary.totalCash + summary.totalCard + summary.totalWallet)) * 100), color: "bg-emerald-400" },
              { pct: Math.round((summary.totalCard / (summary.totalCash + summary.totalCard + summary.totalWallet)) * 100), color: "bg-sky-400" },
              { pct: Math.round((summary.totalWallet / (summary.totalCash + summary.totalCard + summary.totalWallet)) * 100), color: "bg-violet-400" },
            ].map((seg, i) => (
              <div key={i} className={cn("h-full rounded-full", seg.color)} style={{ width: `${seg.pct}%` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards row */}
      <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className={cn("rounded-2xl border p-3.5 backdrop-blur-sm", card.bg, card.border)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", card.bg)}>
                  <Icon className={cn("w-3.5 h-3.5", card.color)} />
                </div>
                <span className="text-xs text-slate-400">{card.label}</span>
              </div>
              <p className={cn("text-lg font-bold tabular-nums", card.color)}>
                ₺{card.value.toLocaleString("tr-TR")}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
