"use client"

import { useState } from "react"
import { Banknote, CreditCard, Wallet, Trash2, ChevronRight, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PaymentEntry, PaymentMethod, Customer } from "@/types/hizli-kayit"

interface PaymentPanelProps {
  total: number
  /** Optional split — when retail items are present, render the
   *  Oyun / Perakende / Toplam breakdown above the payment grid. */
  gameTotal?:   number
  retailTotal?: number
  discount?:    number
  payments: PaymentEntry[]
  customer: Customer | null
  onAddPayment: (method: PaymentMethod, amount: number) => void
  onRemovePayment: (id: string) => void
  onUpdatePayment: (id: string, amount: number) => void
}

const PAYMENT_METHODS: {
  method: PaymentMethod
  label: string
  icon: React.ElementType
  textColor: string
  iconBg: string
  activeBorder: string
  activeBg: string
  rowBorder: string
  rowBg: string
  hoverBorder: string
}[] = [
  {
    method: "cash",
    label: "Nakit",
    icon: Banknote,
    textColor: "text-emerald-700 dark:text-emerald-400",
    iconBg: "bg-emerald-500",
    activeBorder: "border-emerald-500",
    activeBg: "bg-emerald-50 dark:bg-emerald-500/10",
    rowBorder: "border-l-emerald-400",
    rowBg: "bg-emerald-50/60 dark:bg-emerald-500/5 border-slate-200 dark:border-slate-700",
    hoverBorder: "hover:border-emerald-400",
  },
  {
    method: "card",
    label: "Kart",
    icon: CreditCard,
    textColor: "text-blue-700 dark:text-blue-400",
    iconBg: "bg-blue-500",
    activeBorder: "border-blue-500",
    activeBg: "bg-blue-50 dark:bg-blue-500/10",
    rowBorder: "border-l-blue-400",
    rowBg: "bg-blue-50/60 dark:bg-blue-500/5 border-slate-200 dark:border-slate-700",
    hoverBorder: "hover:border-blue-400",
  },
  {
    method: "wallet",
    label: "Cüzdan",
    icon: Wallet,
    textColor: "text-violet-700 dark:text-violet-400",
    iconBg: "bg-violet-500",
    activeBorder: "border-violet-500",
    activeBg: "bg-violet-50 dark:bg-violet-500/10",
    rowBorder: "border-l-violet-400",
    rowBg: "bg-violet-50/60 dark:bg-violet-500/5 border-slate-200 dark:border-slate-700",
    hoverBorder: "hover:border-violet-400",
  },
]

const METHOD_MAP = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.method, m])) as Record<PaymentMethod, typeof PAYMENT_METHODS[0]>

export function PaymentPanel({
  total,
  gameTotal,
  retailTotal,
  discount,
  payments,
  customer,
  onAddPayment,
  onRemovePayment,
  onUpdatePayment,
}: PaymentPanelProps) {
  const discountAmount = discount ?? 0
  const showBreakdown  = (gameTotal ?? 0) > 0 || (retailTotal ?? 0) > 0 || discountAmount > 0
  const [activeMethod, setActiveMethod] = useState<PaymentMethod | null>(null)
  const [inputAmount, setInputAmount] = useState("")

  const paid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = Math.max(0, total - paid)
  const overpaid = paid > total ? paid - total : 0
  const isComplete = total > 0 && paid >= total

  const walletBalance = customer?.walletBalance ?? 0

  function handleConfirm() {
    if (!activeMethod) return
    const amount = parseFloat(inputAmount)
    if (!amount || amount <= 0) return

    if (activeMethod === "wallet" && amount > walletBalance) return

    onAddPayment(activeMethod, amount)
    setInputAmount("")
    setActiveMethod(null)
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Ödeme</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Split payment destekli</p>
        </div>
        {isComplete && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Tamamlandı</span>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className={cn(
        "rounded-2xl p-4 transition-all",
        isComplete
          ? "bg-gradient-to-br from-emerald-500 to-green-600 text-white"
          : total > 0
          ? "bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-900 text-white"
          : "bg-slate-100 dark:bg-slate-800"
      )}>
        {showBreakdown && (
          <div className={cn("mb-3 space-y-1 text-xs", total > 0 ? "text-white/85" : "text-slate-500")}>
            {(gameTotal ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span>Oyun</span>
                <span className="font-semibold tabular-nums">₺{(gameTotal ?? 0).toLocaleString("tr-TR")}</span>
              </div>
            )}
            {(retailTotal ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span>Perakende</span>
                <span className="font-semibold tabular-nums">₺{(retailTotal ?? 0).toLocaleString("tr-TR")}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-amber-200">
                <span>İndirim</span>
                <span className="font-semibold tabular-nums">−₺{discountAmount.toLocaleString("tr-TR")}</span>
              </div>
            )}
            <div className="h-px bg-white/15" />
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <span className={cn("text-xs font-medium", total > 0 ? "text-white/70" : "text-slate-500")}>
            {showBreakdown ? "Genel Toplam" : "Toplam Tutar"}
          </span>
          <span className={cn("text-2xl font-bold tracking-tight", total > 0 ? "text-white" : "text-slate-400")}>
            ₺{total.toLocaleString("tr-TR")}
          </span>
        </div>
        {total > 0 && (
          <>
            <div className="h-px bg-white/20 mb-3" />
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Ödenen</span>
                <span className="font-semibold text-white">₺{paid.toLocaleString("tr-TR")}</span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Kalan</span>
                  <span className="font-bold text-amber-300">₺{remaining.toLocaleString("tr-TR")}</span>
                </div>
              )}
              {overpaid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Para Üstü</span>
                  <span className="font-bold text-emerald-300">₺{overpaid.toLocaleString("tr-TR")}</span>
                </div>
              )}
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (paid / total) * 100)}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Existing payments */}
      {payments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Ödeme Girişleri</p>
          {payments.map((payment) => {
            const meta = METHOD_MAP[payment.method]
            const Icon = meta.icon
            return (
              <div
                key={payment.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border border-l-4",
                  meta.rowBg,
                  meta.rowBorder,
                )}
              >
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0", meta.iconBg)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className={cn("text-xs font-bold flex-1", meta.textColor)}>{meta.label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-slate-500">₺</span>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) => onUpdatePayment(payment.id, parseFloat(e.target.value) || 0)}
                    className="w-16 text-right text-sm font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => onRemovePayment(payment.id)}
                  className="w-6 h-6 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/10 flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add payment method */}
      {total > 0 && !isComplete && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {!activeMethod ? (
            <>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Ödeme Yöntemi Ekle</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const { method, label, icon: Icon, textColor, iconBg, activeBorder, activeBg, hoverBorder } = m
                  const isWallet = method === "wallet"
                  const disabled = isWallet && walletBalance === 0
                  return (
                    <button
                      key={method}
                      onClick={() => {
                        if (disabled) return
                        setActiveMethod(method)
                        // Auto-fill the whole remaining amount so single-tender
                        // payments (default case) only need one click. Staff
                        // manually reduces this for split payments.
                        const seed = method === "wallet"
                          ? Math.min(remaining, walletBalance)
                          : remaining
                        setInputAmount(seed > 0 ? String(seed) : "")
                      }}
                      disabled={disabled}
                      className={cn(
                        "flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all",
                        disabled
                          ? "border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed"
                          : cn(
                              "border-slate-200 dark:border-slate-700 active:scale-95 shadow-sm",
                              hoverBorder,
                              "hover:shadow-md"
                            )
                      )}
                    >
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm", iconBg)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={cn("text-xs font-bold", disabled ? "text-slate-400" : textColor)}>{label}</span>
                      {isWallet && walletBalance > 0 && (
                        <span className="text-[10px] font-bold text-violet-500">₺{walletBalance}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="animate-in slide-in-from-bottom-2 duration-200">
              {(() => {
                const meta = METHOD_MAP[activeMethod!]
                const Icon = meta.icon
                const isWallet = activeMethod === "wallet"
                const maxWallet = isWallet ? walletBalance : undefined
                return (
                  <div className={cn(
                    "rounded-2xl border-2 p-4 space-y-3",
                    meta.activeBorder,
                    meta.activeBg,
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm", meta.iconBg)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={cn("text-sm font-bold", meta.textColor)}>{meta.label}</span>
                        {isWallet && <span className="text-xs text-violet-500 font-semibold">Bakiye: ₺{walletBalance}</span>}
                      </div>
                      <button
                        onClick={() => { setActiveMethod(null); setInputAmount("") }}
                        className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                      >
                        Vazgeç
                      </button>
                    </div>

                    {/* Amount input — auto-filled with the remaining total.
                        Staff can override for split payment (mixed cash/card). */}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₺</span>
                      <input
                        type="number"
                        value={inputAmount}
                        onChange={(e) => setInputAmount(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                        max={maxWallet}
                        placeholder={`Tutar gir (kalan: ₺${remaining})`}
                        className="w-full pl-7 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>

                    <button
                      onClick={handleConfirm}
                      disabled={!inputAmount || parseFloat(inputAmount) <= 0}
                      className={cn(
                        "w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed",
                        "text-white shadow-sm active:scale-[0.98]",
                        meta.iconBg,
                        "hover:opacity-90"
                      )}
                    >
                      Ekle <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {total === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Wallet className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Çocuk ekleyince ödeme başlar</p>
          </div>
        </div>
      )}
    </div>
  )
}
