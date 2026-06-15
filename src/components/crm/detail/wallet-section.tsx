import { ArrowUpCircle, ArrowDownCircle, Gift, RefreshCw, Wallet } from "lucide-react"
import type { Customer, WalletTxType } from "@/types/crm"
import { cn } from "@/lib/utils"

const TX_META: Record<WalletTxType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  load: { label: "Yükleme", icon: ArrowUpCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10" },
  use: { label: "Kullanım", icon: ArrowDownCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/10" },
  refund: { label: "İade", icon: RefreshCw, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/10" },
  bonus: { label: "Bonus", icon: Gift, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/10" },
}

export function WalletSection({ customer }: { customer: Customer }) {
  if (customer.walletTransactions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
        <Wallet className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Cüzdan hareketi yok</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-10 translate-x-10" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-violet-200" />
            <span className="text-sm font-medium text-violet-200">Mevcut Bakiye</span>
          </div>
          <p className="text-3xl font-bold">₺{customer.walletBalance.toLocaleString("tr-TR")}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-violet-200">
            <span>Toplam yükleme: ₺{customer.walletTransactions.filter(t => t.type === "load").reduce((s, t) => s + t.amount, 0).toLocaleString("tr-TR")}</span>
            <span>·</span>
            <span>Bonus: ₺{customer.walletTransactions.filter(t => t.type === "bonus").reduce((s, t) => s + t.amount, 0).toLocaleString("tr-TR")}</span>
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Hareketler</p>
          <p className="text-xs text-slate-500">{customer.walletTransactions.length} kayıt</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {customer.walletTransactions.map((tx) => {
            const meta = TX_META[tx.type]
            const Icon = meta.icon
            const isPositive = tx.amount > 0
            return (
              <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", meta.bg)}>
                  <Icon className={cn("w-4 h-4", meta.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", meta.bg, meta.color)}>{meta.label}</span>
                    <span className="text-[10px] text-slate-400">{tx.date.slice(5).replace("-", "/")}</span>
                    {tx.staffName && <span className="text-[10px] text-slate-400">· {tx.staffName}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn("text-sm font-bold", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {isPositive ? "+" : ""}₺{Math.abs(tx.amount).toLocaleString("tr-TR")}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Bakiye: ₺{tx.balance}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
