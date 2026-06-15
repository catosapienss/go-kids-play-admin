"use client"

import { ArrowDownLeft, ArrowUpRight, Gift, RotateCcw, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_USER, WALLET_TRANSACTIONS } from "@/lib/app-data"
import type { AppWalletTx } from "@/lib/app-data"

const TX_CONFIG: Record<AppWalletTx["type"], {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  sign: string
  amountColor: string
  label: string
}> = {
  use: {
    icon: ArrowUpRight,
    iconBg: "bg-rose-100 dark:bg-rose-500/20",
    iconColor: "text-rose-500",
    sign: "-",
    amountColor: "text-rose-600 dark:text-rose-400",
    label: "Kullanım",
  },
  load: {
    icon: ArrowDownLeft,
    iconBg: "bg-emerald-100 dark:bg-emerald-500/20",
    iconColor: "text-emerald-600",
    sign: "+",
    amountColor: "text-emerald-600 dark:text-emerald-400",
    label: "Yükleme",
  },
  bonus: {
    icon: Gift,
    iconBg: "bg-violet-100 dark:bg-violet-500/20",
    iconColor: "text-violet-600",
    sign: "+",
    amountColor: "text-violet-600 dark:text-violet-400",
    label: "Bonus",
  },
  refund: {
    icon: RotateCcw,
    iconBg: "bg-sky-100 dark:bg-sky-500/20",
    iconColor: "text-sky-600",
    sign: "+",
    amountColor: "text-sky-600 dark:text-sky-400",
    label: "İade",
  },
}

export function WalletScreen() {
  const totalBalance = APP_USER.walletBalance + APP_USER.bonusBalance

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#0a0a14]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 pt-2 pb-10 px-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20" />
        <p className="relative text-white/60 text-sm mb-0.5">Dijital Cüzdan</p>
        <p className="relative text-white font-black text-2xl mb-6">Bakiyem</p>

        {/* Balance card */}
        <div className="relative bg-white/12 backdrop-blur-sm rounded-3xl p-5 border border-white/15">
          <p className="text-white/50 text-[10px] font-black tracking-widest uppercase mb-1">Ana Bakiye</p>
          <p className="text-white font-black text-5xl tabular-nums leading-none mb-1">
            ₺{APP_USER.walletBalance.toLocaleString("tr-TR")}
          </p>
          {APP_USER.bonusBalance > 0 && (
            <p className="text-white/50 text-xs mb-4">
              +₺{APP_USER.bonusBalance} bonus · Toplam ₺{totalBalance.toLocaleString("tr-TR")}
            </p>
          )}

          {/* Balance pills */}
          <div className="flex gap-2">
            <div className="flex-1 bg-white/10 rounded-2xl p-3 text-center">
              <p className="text-white/50 text-[10px] font-black uppercase tracking-wide mb-0.5">Cüzdan</p>
              <p className="text-white font-black text-base">₺{APP_USER.walletBalance}</p>
            </div>
            <div className="flex-1 bg-amber-400/20 rounded-2xl p-3 text-center">
              <p className="text-amber-200/70 text-[10px] font-black uppercase tracking-wide mb-0.5">Bonus</p>
              <p className="text-amber-200 font-black text-base">₺{APP_USER.bonusBalance}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4 pb-6">
        {/* Load wallet button */}
        <button className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl shadow-lg shadow-violet-500/30 text-white font-black text-sm active:scale-95 transition-transform">
          <Plus className="w-4 h-4" />
          Cüzdana Yükle
        </button>

        {/* Quick load amounts */}
        <div className="grid grid-cols-4 gap-2">
          {[100, 200, 500, 1000].map((amt) => (
            <button
              key={amt}
              className="py-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-sm font-bold text-slate-700 dark:text-slate-300 active:scale-95 transition-transform"
            >
              ₺{amt}
            </button>
          ))}
        </div>

        {/* Transaction history */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black text-slate-900 dark:text-white">İşlem Geçmişi</p>
            <button className="text-xs font-semibold text-violet-600 dark:text-violet-400">Tümü →</button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            {WALLET_TRANSACTIONS.map((tx, i) => {
              const cfg = TX_CONFIG[tx.type]
              const Icon = cfg.icon
              return (
                <div
                  key={tx.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5",
                    i < WALLET_TRANSACTIONS.length - 1 && "border-b border-slate-50 dark:border-slate-800"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0", cfg.iconBg)}>
                    <Icon className={cn("w-5 h-5", cfg.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{tx.description}</p>
                    <p className="text-xs text-slate-400">{tx.date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn("text-sm font-black", cfg.amountColor)}>
                      {cfg.sign}₺{tx.amount}
                    </p>
                    <p className="text-[10px] text-slate-400">{cfg.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bonus info banner */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-800/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Gift className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Bonus Kampanyası</p>
              <p className="text-xs text-amber-700/70 dark:text-amber-400/60 mt-0.5">
                ₺500 ve üzeri yüklemelerde %10 bonus kazanın. ₺1.000 üzeri için %10 bonus!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
