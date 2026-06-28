"use client"

import { useEffect, useRef, useState } from "react"
import { Percent, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { DiscountPicker } from "./discount-picker"
import type { DiscountType, DiscountReason } from "@/lib/services/discount.service"

// ─── DiscountActionButton ────────────────────────────────────────────────────
//
// Compact button for the bottom action bar. When the user clicks it, a
// popover anchored above the button reveals the full DiscountPicker. Mirrors
// state up to the parent so the payment panel stays in sync.

interface Props {
  baseAmount: number
  amount:     number      // resolved ₺ (read-only display)
  type:       DiscountType
  value:      number
  reason:     DiscountReason | null
  onChange:   (next: { type: DiscountType; value: number; reason: DiscountReason | null }) => void
}

export function DiscountActionButton({ baseAmount, amount, type, value, reason, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const isApplied = amount > 0
  const valueLabel = isApplied
    ? type === "percent"
      ? `%${value} (₺${amount.toLocaleString("tr-TR")})`
      : `₺${amount.toLocaleString("tr-TR")}`
    : "İndirim"

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all active:scale-95",
          isApplied
            ? "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10",
        )}
      >
        <Percent className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{valueLabel}</span>
        {isApplied && (
          <X
            className="w-3 h-3 ml-1 opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onChange({ type, value: 0, reason: null })
            }}
          />
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-[340px] max-w-[90vw]">
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
