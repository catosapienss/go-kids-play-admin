"use client"

import {
  Banknote, CreditCard, Wallet, ArrowDownLeft,
  Gift, ArrowUpRight, SplitSquareVertical
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { FinTransaction } from "@/types/cuzdan"
import { getTxTypeLabel, getMethodLabel } from "@/lib/cuzdan-data"

const TX_META = {
  payment: {
    icon: ArrowUpRight,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/10",
    amountColor: "text-emerald-700 dark:text-emerald-400",
    prefix: "+",
  },
  wallet_load: {
    icon: Wallet,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-500/10",
    amountColor: "text-violet-700 dark:text-violet-400",
    prefix: "+",
  },
  wallet_use: {
    icon: Wallet,
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-100 dark:bg-sky-500/10",
    amountColor: "text-sky-700 dark:text-sky-400",
    prefix: "−",
  },
  refund: {
    icon: ArrowDownLeft,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-500/10",
    amountColor: "text-rose-700 dark:text-rose-400",
    prefix: "−",
  },
  bonus: {
    icon: Gift,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/10",
    amountColor: "text-amber-700 dark:text-amber-400",
    prefix: "+",
  },
}

const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  wallet: Wallet,
  split: SplitSquareVertical,
}

function SplitBadges({ split }: { split: FinTransaction["split"] }) {
  if (!split) return null
  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      {split.cash && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-semibold">
          <Banknote className="w-2.5 h-2.5" />
          ₺{split.cash.toLocaleString("tr-TR")} Nakit
        </span>
      )}
      {split.card && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 rounded text-[10px] font-semibold">
          <CreditCard className="w-2.5 h-2.5" />
          ₺{split.card.toLocaleString("tr-TR")} Kart
        </span>
      )}
      {split.wallet && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 rounded text-[10px] font-semibold">
          <Wallet className="w-2.5 h-2.5" />
          ₺{split.wallet.toLocaleString("tr-TR")} Cüzdan
        </span>
      )}
    </div>
  )
}

interface TransactionTimelineProps {
  transactions: FinTransaction[]
  onRefund?: (tx: FinTransaction) => void
  compact?: boolean
}

export function TransactionTimeline({ transactions, onRefund, compact }: TransactionTimelineProps) {
  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center">
        <ArrowUpRight className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-400">İşlem bulunamadı</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {transactions.map((tx) => {
        const meta = TX_META[tx.type]
        const Icon = meta.icon
        const MethodIcon = METHOD_ICONS[tx.method]
        const isRefundable = tx.type === "payment" && tx.status === "completed"

        return (
          <div
            key={tx.id}
            className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
          >
            {/* Type icon */}
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", meta.bg)}>
              <Icon className={cn("w-4 h-4", meta.color)} />
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {tx.customerName}
                    </p>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {getTxTypeLabel(tx.type)}
                    </span>
                  </div>
                  {!compact && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{tx.service}</p>
                  )}
                  {tx.split && <SplitBadges split={tx.split} />}
                  {tx.cancelReason && (
                    <p className="text-xs text-rose-500 mt-0.5">{tx.cancelReason}</p>
                  )}
                  {tx.note && !tx.cancelReason && (
                    <p className="text-xs text-slate-400 mt-0.5">{tx.note}</p>
                  )}
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className={cn("text-sm font-bold tabular-nums", meta.amountColor)}>
                    {meta.prefix}₺{tx.amount.toLocaleString("tr-TR")}
                  </p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <MethodIcon className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] text-slate-400">{getMethodLabel(tx.method)}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[10px] text-slate-400">
                  {tx.staffName} · {tx.datetime.split(" ")[1]}
                </p>
                {isRefundable && onRefund && (
                  <button
                    onClick={() => onRefund(tx)}
                    className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    İptal / İade
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
