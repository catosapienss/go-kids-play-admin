"use client"

import { useState } from "react"
import { Percent, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { DiscountPicker } from "./discount-picker"
import type { DiscountType, DiscountReason } from "@/lib/services/discount.service"

// ─── DiscountSection — Hızlı Kayıt right sidebar ─────────────────────────────
//
// Always-visible discount row for the fixed payment sidebar. Collapsed it is a
// single tap-target showing the current discount (₺0 by default — discounts
// are NEVER auto-applied); expanded it reveals the full DiscountPicker.
// State lives in the parent so the payment panel + action bar stay in sync.

interface Props {
  baseAmount: number
  amount:     number      // resolved ₺ (read-only display)
  type:       DiscountType
  value:      number
  reason:     DiscountReason | null
  onChange:   (next: { type: DiscountType; value: number; reason: DiscountReason | null }) => void
}

export function DiscountSection({ baseAmount, amount, type, value, reason, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const isApplied = amount > 0

  return (
    <div className={cn(
      "rounded-2xl border transition-colors overflow-hidden",
      isApplied
        ? "border-amber-300 dark:border-amber-500/40"
        : "border-slate-200 dark:border-slate-800",
      "bg-white dark:bg-slate-900",
    )}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
          isApplied
            ? "bg-amber-500 text-white"
            : "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
        )}>
          <Percent className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">İndirim</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {isApplied ? "Personel tarafından uygulandı" : "Varsayılan indirim yok · sadece istenirse"}
          </p>
        </div>
        <span className={cn(
          "text-sm font-black tabular-nums",
          isApplied ? "text-amber-700 dark:text-amber-300" : "text-slate-400",
        )}>
          {isApplied
            ? type === "percent" ? `%${value} · −₺${amount.toLocaleString("tr-TR")}` : `−₺${amount.toLocaleString("tr-TR")}`
            : "₺0"}
        </span>
        {isApplied && (
          <span
            role="button"
            tabIndex={0}
            aria-label="İndirimi kaldır"
            onClick={(e) => {
              e.stopPropagation()
              onChange({ type, value: 0, reason: null })
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation()
                onChange({ type, value: 0, reason: null })
              }
            }}
            className="p-1 rounded-md text-amber-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown className={cn(
          "w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0",
          open && "rotate-180",
        )} />
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-2">
          <DiscountPicker
            baseAmount={baseAmount}
            type={type}
            value={value}
            reason={reason}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}
