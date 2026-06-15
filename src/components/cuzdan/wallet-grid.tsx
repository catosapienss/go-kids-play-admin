"use client"

import { useState } from "react"
import { Wallet, Plus, History, ChevronDown, ChevronUp, ArrowDownLeft, ArrowUpRight, Gift } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CustomerWallet, WalletTx } from "@/types/cuzdan"

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-green-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
]

const WALLET_TX_META = {
  load: { icon: ArrowUpRight, color: "text-emerald-600 dark:text-emerald-400", label: "Yükleme" },
  use: { icon: ArrowDownLeft, color: "text-rose-600 dark:text-rose-400", label: "Kullanım" },
  bonus: { icon: Gift, color: "text-amber-600 dark:text-amber-400", label: "Bonus" },
  refund: { icon: ArrowDownLeft, color: "text-violet-600 dark:text-violet-400", label: "İade" },
}

function WalletTxItem({ tx }: { tx: WalletTx }) {
  const meta = WALLET_TX_META[tx.type]
  const Icon = meta.icon
  const isIncome = tx.type === "load" || tx.type === "bonus" || tx.type === "refund"

  return (
    <div className="flex items-center gap-2.5 py-2">
      <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-800")}>
        <Icon className={cn("w-3 h-3", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{meta.label}</p>
        <p className="text-[10px] text-slate-400">{tx.staffName} · {tx.datetime.split(" ")[1]}</p>
      </div>
      <p className={cn("text-xs font-bold tabular-nums", isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300")}>
        {isIncome ? "+" : "−"}₺{tx.amount.toLocaleString("tr-TR")}
      </p>
    </div>
  )
}

function WalletCard({ wallet, idx, onLoad }: { wallet: CustomerWallet; idx: number; onLoad: (w: CustomerWallet) => void }) {
  const [expanded, setExpanded] = useState(false)
  const gradient = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
  const usePct = wallet.totalLoaded > 0 ? Math.min(100, Math.round((wallet.totalUsed / wallet.totalLoaded) * 100)) : 0
  const totalBalance = wallet.balance + wallet.bonusBalance

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-base flex-shrink-0", gradient)}>
            {wallet.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{wallet.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{wallet.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              ₺{totalBalance.toLocaleString("tr-TR")}
            </p>
            {wallet.bonusBalance > 0 && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                +₺{wallet.bonusBalance.toLocaleString("tr-TR")} bonus
              </span>
            )}
          </div>
        </div>

        {/* Usage bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400">Kullanım</span>
            <span className="text-[10px] text-slate-400">₺{wallet.totalUsed.toLocaleString("tr-TR")} / ₺{wallet.totalLoaded.toLocaleString("tr-TR")}</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all"
              style={{ width: `${usePct}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onLoad(wallet)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Yükle
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Geçmiş
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expanded transactions */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2">
          {wallet.transactions.map((tx) => (
            <WalletTxItem key={tx.id} tx={tx} />
          ))}
        </div>
      )}
    </div>
  )
}

interface WalletGridProps {
  wallets: CustomerWallet[]
  onLoad: (wallet: CustomerWallet) => void
}

export function WalletGrid({ wallets, onLoad }: WalletGridProps) {
  const totalBalance = wallets.reduce((s, w) => s + w.balance + w.bonusBalance, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{wallets.length} Aktif Cüzdan</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Toplam Bakiye</p>
          <p className="text-sm font-bold text-violet-600 dark:text-violet-400 tabular-nums">₺{totalBalance.toLocaleString("tr-TR")}</p>
        </div>
      </div>

      {/* Wallet cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {wallets.map((wallet, idx) => (
          <WalletCard key={wallet.id} wallet={wallet} idx={idx} onLoad={onLoad} />
        ))}
      </div>
    </div>
  )
}
