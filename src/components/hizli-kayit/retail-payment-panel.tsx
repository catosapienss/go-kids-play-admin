"use client"

import { useState } from "react"
import { Banknote, CreditCard, Trash2, ShoppingBag, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PaymentEntry, PaymentMethod } from "@/types/hizli-kayit"

// ─── Retail Payment Panel ───────────────────────────────────────────────────
//
// Sits below the main game-session PaymentPanel when the cart has items.
// Explicitly tracks WHICH tender was used for the retail portion so the
// day-end reports can show "perakende kart: ₺X, perakende nakit: ₺Y"
// instead of a proportional guess.
//
// Wallet is not accepted for retail (products are not membership benefits).

interface Props {
  total:           number
  payments:        PaymentEntry[]
  onAdd:           (method: "cash" | "card", amount: number) => void
  onRemove:        (id: string) => void
  onUpdate:        (id: string, amount: number) => void
}

const METHOD_META: Record<"cash" | "card", { label: string; icon: typeof Banknote; iconBg: string; textColor: string; rowBg: string; rowBorder: string }> = {
  cash: {
    label: "Nakit", icon: Banknote,
    iconBg: "bg-emerald-500",
    textColor: "text-emerald-700 dark:text-emerald-400",
    rowBg: "bg-emerald-50/60 dark:bg-emerald-500/5 border-slate-200 dark:border-slate-700",
    rowBorder: "border-l-emerald-400",
  },
  card: {
    label: "Kart", icon: CreditCard,
    iconBg: "bg-blue-500",
    textColor: "text-blue-700 dark:text-blue-400",
    rowBg: "bg-blue-50/60 dark:bg-blue-500/5 border-slate-200 dark:border-slate-700",
    rowBorder: "border-l-blue-400",
  },
}

export function RetailPaymentPanel({ total, payments, onAdd, onRemove, onUpdate }: Props) {
  const [activeMethod, setActiveMethod] = useState<"cash" | "card" | null>(null)
  const [inputAmount, setInputAmount] = useState("")

  const paid = payments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, total - paid)
  const isComplete = total > 0 && paid >= total

  if (total <= 0) return null

  function confirm() {
    if (!activeMethod) return
    const amount = parseFloat(inputAmount)
    if (!amount || amount <= 0) return
    onAdd(activeMethod, amount)
    setInputAmount("")
    setActiveMethod(null)
  }

  return (
    <div className={cn(
      "rounded-2xl border-2 p-3 space-y-2.5 transition-colors",
      isComplete
        ? "border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-500/[0.04]"
        : "border-amber-300/60 bg-amber-50/40 dark:bg-amber-500/[0.04]",
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center">
            <ShoppingBag className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">
              Perakende Ödemesi
            </p>
            <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
              ₺{total.toLocaleString("tr-TR")}
              {remaining > 0 && <span className="text-amber-600 dark:text-amber-400 ml-2">· Kalan ₺{remaining.toLocaleString("tr-TR")}</span>}
            </p>
          </div>
        </div>
        {isComplete && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
            <CheckCircle2 className="w-3 h-3" />
            Tamam
          </div>
        )}
      </div>

      {/* Existing entries */}
      {payments.length > 0 && (
        <ul className="space-y-1">
          {payments.map((p) => {
            const meta = METHOD_META[p.method as "cash" | "card"]
            if (!meta) return null
            const Icon = meta.icon
            return (
              <li key={p.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border border-l-4",
                    meta.rowBg, meta.rowBorder,
                  )}>
                <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white flex-shrink-0", meta.iconBg)}>
                  <Icon className="w-3 h-3" />
                </div>
                <span className={cn("text-[11px] font-bold flex-1", meta.textColor)}>{meta.label}</span>
                <span className="text-xs font-bold text-slate-500">₺</span>
                <input
                  type="number"
                  value={p.amount}
                  onChange={(e) => onUpdate(p.id, parseFloat(e.target.value) || 0)}
                  className="w-14 text-right text-xs font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none"
                />
                <button
                  onClick={() => onRemove(p.id)}
                  aria-label="Sil"
                  className="w-5 h-5 rounded hover:bg-red-100 dark:hover:bg-red-500/10 flex items-center justify-center"
                >
                  <Trash2 className="w-2.5 h-2.5 text-red-400" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Add-payment area */}
      {!isComplete && (
        !activeMethod ? (
          <div className="grid grid-cols-2 gap-1.5">
            {(["cash", "card"] as const).map((m) => {
              const meta = METHOD_META[m]
              const Icon = meta.icon
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setActiveMethod(m)
                    setInputAmount(remaining > 0 ? String(remaining) : "")
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-xs font-bold transition-all hover:border-amber-400",
                  )}
                >
                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-white", meta.iconBg)}>
                    <Icon className="w-3 h-3" />
                  </div>
                  {meta.label}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₺</span>
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirm()}
                placeholder={`Kalan ₺${remaining}`}
                className="w-full pl-6 pr-2 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>
            <button
              onClick={confirm}
              disabled={!inputAmount || parseFloat(inputAmount) <= 0}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed",
                METHOD_META[activeMethod].iconBg,
              )}
            >
              Ekle
            </button>
            <button
              onClick={() => { setActiveMethod(null); setInputAmount("") }}
              className="px-2 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              İptal
            </button>
          </div>
        )
      )}
    </div>
  )
}

// Helper used by hizli-kayit page.tsx to produce a checkoutSale payload.
export function summariseRetailPayments(payments: PaymentEntry[]): {
  cash: number; card: number; method: "cash" | "card" | "split"
} {
  const cash = payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0)
  const card = payments.filter((p) => p.method === "card").reduce((s, p) => s + p.amount, 0)
  return {
    cash, card,
    method: cash > 0 && card > 0 ? "split" : cash > 0 ? "cash" : "card",
  }
}

/** New PaymentEntry — retail payments use the same shape but only cash|card. */
export type RetailMethod = "cash" | "card"
export type RetailPayment = Omit<PaymentEntry, "method"> & { method: PaymentMethod }
