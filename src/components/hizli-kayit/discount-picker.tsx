"use client"

import { useMemo } from "react"
import { Percent, Banknote, Lock, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useSettingsSection } from "@/lib/settings/settings-store"
import {
  DISCOUNT_REASON_LABELS, computeDiscountAmount, maxDiscountForRole,
  type DiscountType, type DiscountReason,
} from "@/lib/services/discount.service"

// ─── DiscountPicker — Hızlı Kayıt Section 5 ─────────────────────────────────
//
// Lets the cashier shave a percent or fixed-₺ amount off the gross total. The
// resolved ₺ amount is enforced against the operator's per-role cap (configured
// in /ayarlar → İndirim Yetkileri). Admin/super_admin/owner are uncapped.
//
// Props are fully controlled — the parent owns the discount state so the
// breakdown can render in the payment panel and the audit row can be written
// after the session is created.

interface Props {
  baseAmount: number                                    // gameTotal + retailTotal (gross)
  type:       DiscountType
  value:      number
  reason:     DiscountReason | null
  onChange:   (next: { type: DiscountType; value: number; reason: DiscountReason | null }) => void
}

const REASON_KEYS = Object.keys(DISCOUNT_REASON_LABELS) as DiscountReason[]

export function DiscountPicker({ baseAmount, type, value, reason, onChange }: Props) {
  const { user } = useAuth()
  const limits = useSettingsSection("discounts")

  const maxAmount  = useMemo(() => maxDiscountForRole(user?.role, limits), [user?.role, limits])
  const isUnlimited = !isFinite(maxAmount)
  const computedRaw = computeDiscountAmount(type, value, baseAmount)
  const capped      = Math.min(computedRaw, isUnlimited ? computedRaw : maxAmount)
  const isOverCap   = !isUnlimited && computedRaw > maxAmount
  const finalAmount = capped

  const handleType = (t: DiscountType) => {
    if (t === type) return
    onChange({ type: t, value: 0, reason })
  }

  const handleValue = (v: string) => {
    const n = Math.max(0, Number(v) || 0)
    onChange({ type, value: n, reason })
  }

  const handleClear = () => onChange({ type, value: 0, reason: null })

  const allowPercent = limits.allowPercentDiscount

  return (
    <div className={cn(
      "rounded-2xl border bg-white dark:bg-slate-900 p-4 transition-colors",
      finalAmount > 0
        ? "border-amber-300 dark:border-amber-500/40 shadow-sm shadow-amber-500/5"
        : "border-slate-200 dark:border-slate-800",
    )}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center">
          <Percent className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">İndirim</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {isUnlimited
              ? "Limit yok · Yönetici"
              : `Maks. ₺${maxAmount.toLocaleString("tr-TR")} · ${user?.role ?? "personel"}`}
          </p>
        </div>
        {finalAmount > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            title="İndirimi temizle"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {allowPercent && (
          <button
            type="button"
            onClick={() => handleType("percent")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-bold transition-all",
              type === "percent"
                ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-amber-300",
            )}
          >
            <Percent className="w-3.5 h-3.5" />
            Yüzde (%)
          </button>
        )}
        <button
          type="button"
          onClick={() => handleType("fixed")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-bold transition-all",
            !allowPercent && "col-span-2",
            type === "fixed"
              ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-amber-300",
          )}
        >
          <Banknote className="w-3.5 h-3.5" />
          Sabit (₺)
        </button>
      </div>

      {/* Value input + quick chips */}
      <div className="flex items-stretch gap-2 mb-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
            {type === "percent" ? "%" : "₺"}
          </span>
          <input
            type="number"
            min={0}
            value={value || ""}
            onChange={(e) => handleValue(e.target.value)}
            placeholder={type === "percent" ? "10" : "50"}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex items-center gap-1">
          {(type === "percent" ? [5, 10, 20] : [25, 50, 100]).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleValue(String(n))}
              className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-600"
            >
              {type === "percent" ? `${n}%` : `₺${n}`}
            </button>
          ))}
        </div>
      </div>

      {/* Reason */}
      <div className="mb-3">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
          Sebep (opsiyonel)
        </label>
        <select
          value={reason ?? ""}
          onChange={(e) => onChange({ type, value, reason: (e.target.value || null) as DiscountReason | null })}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-amber-500"
        >
          <option value="">Sebep seç…</option>
          {REASON_KEYS.map((k) => (
            <option key={k} value={k}>{DISCOUNT_REASON_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* Resolved amount */}
      <div className={cn(
        "rounded-xl px-3 py-2 flex items-center justify-between text-xs",
        finalAmount > 0
          ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30"
          : "bg-slate-50 dark:bg-slate-800/50",
      )}>
        <span className={cn(
          "font-bold",
          finalAmount > 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-500",
        )}>
          Uygulanacak indirim
        </span>
        <span className={cn(
          "font-black tabular-nums",
          finalAmount > 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-400",
        )}>
          ₺{finalAmount.toLocaleString("tr-TR")}
        </span>
      </div>

      {isOverCap && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
          <Lock className="w-3 h-3" />
          Yetki limitiniz ₺{maxAmount.toLocaleString("tr-TR")} · ₺{(computedRaw - maxAmount).toLocaleString("tr-TR")} kısıldı
        </p>
      )}
    </div>
  )
}
