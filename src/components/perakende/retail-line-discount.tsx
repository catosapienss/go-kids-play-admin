"use client"

import { useEffect, useRef, useState } from "react"
import { MoreVertical, Percent, Banknote, Tag, X, Check, Trash2, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  RETAIL_DISCOUNT_REASON_LABELS, effectiveUnitPrice, lineDiscountAmount,
  type CartLine, type RetailDiscountType, type RetailDiscountReason, type RetailLineDiscount,
} from "@/types/retail"

// ─── Retail line discount / price-override menu ──────────────────────────────
//
// Compact per-line action menu for the retail cart. Three tools:
//   • İndirim (₺ / %)  → fixed or percent discount
//   • Manuel Fiyat     → sell at a custom unit price (override)
//   • İndirimi Kaldır  → clear
//
// Every discount requires a reason; "Diğer" reveals a free-text note. Staff
// caps + override permission are passed in so the owner's settings gate the UI.

const REASON_KEYS = Object.keys(RETAIL_DISCOUNT_REASON_LABELS) as RetailDiscountReason[]

interface Props {
  line:        CartLine
  canDiscount: boolean   // may apply any discount
  canOverride: boolean   // may set a manual price
  maxDiscount: number    // ₺ cap per line for staff (0 = unlimited)
  onChange:    (discount: RetailLineDiscount | undefined) => void
}

export function RetailLineDiscountMenu({ line, canDiscount, canOverride, maxDiscount, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const existing = line.discount
  const [type,   setType]   = useState<RetailDiscountType>(existing?.type ?? "fixed")
  const [value,  setValue]  = useState<string>(existing ? String(existing.value) : "")
  const [reason, setReason] = useState<RetailDiscountReason>(existing?.reason ?? "customer")
  const [note,   setNote]   = useState<string>(existing?.note ?? "")
  const [error,  setError]  = useState<string | null>(null)

  // Re-seed the form whenever a different discount arrives (e.g. reopened line).
  useEffect(() => {
    if (!open) return
    setType(existing?.type ?? "fixed")
    setValue(existing ? String(existing.value) : "")
    setReason(existing?.reason ?? "customer")
    setNote(existing?.note ?? "")
    setError(null)
  }, [open, existing])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey) }
  }, [open])

  if (!canDiscount && !canOverride) return null

  // Preview the result with the currently-typed values.
  const previewLine: CartLine = { ...line, discount: value ? { type, value: Number(value) || 0, reason, note } : undefined }
  const finalUnit = effectiveUnitPrice(previewLine)
  const discAmt   = lineDiscountAmount(previewLine)
  const overCap   = maxDiscount > 0 && discAmt > maxDiscount

  function apply() {
    const v = Number(value)
    if (!value || !isFinite(v) || v < 0) { setError("Geçerli bir değer gir"); return }
    if (type === "override" && !canOverride) { setError("Manuel fiyat yetkin yok"); return }
    if (overCap) { setError(`Limit ₺${maxDiscount.toLocaleString("tr-TR")} — indirim çok yüksek`); return }
    if (reason === "other" && !note.trim()) { setError("Sebep için not gir"); return }
    onChange({ type, value: v, reason, note: note.trim() || undefined })
    setOpen(false)
  }

  function clear() {
    onChange(undefined)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        title="Fiyat / indirim"
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
          existing
            ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
            : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
        )}
      >
        {existing ? <Tag className="w-3.5 h-3.5" /> : <MoreVertical className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-64 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 animate-in fade-in slide-in-from-top-1 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fiyat / İndirim</p>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Type toggle */}
          <div className="grid grid-cols-3 gap-1 mb-2">
            <TypeBtn active={type === "fixed"}    onClick={() => setType("fixed")}    icon={Banknote} label="₺" disabled={!canDiscount} />
            <TypeBtn active={type === "percent"}  onClick={() => setType("percent")}  icon={Percent}  label="%" disabled={!canDiscount} />
            <TypeBtn active={type === "override"} onClick={() => setType("override")} icon={Tag}      label="Manuel" disabled={!canOverride} />
          </div>

          {/* Value */}
          <div className="relative mb-2">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              {type === "percent" ? "%" : "₺"}
            </span>
            <input
              type="number"
              min={0}
              autoFocus
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null) }}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              placeholder={type === "override" ? "Satış fiyatı" : type === "percent" ? "10" : "50"}
              className="w-full pl-7 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Reason */}
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as RetailDiscountReason)}
            className="w-full px-2.5 py-2 mb-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:border-amber-500"
          >
            {REASON_KEYS.map((k) => <option key={k} value={k}>{RETAIL_DISCOUNT_REASON_LABELS[k]}</option>)}
          </select>

          {reason === "other" && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sebep notu…"
              className="w-full px-2.5 py-2 mb-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:border-amber-500"
            />
          )}

          {/* Preview */}
          {value && (
            <div className={cn(
              "rounded-lg px-2.5 py-1.5 mb-2 flex items-center justify-between text-xs",
              overCap ? "bg-rose-50 dark:bg-rose-500/10" : "bg-slate-50 dark:bg-slate-800/60",
            )}>
              <span className="text-slate-500">Birim: <s className="text-slate-400">₺{line.unitPrice.toLocaleString("tr-TR")}</s> → <strong className="text-slate-900 dark:text-white">₺{finalUnit.toLocaleString("tr-TR")}</strong></span>
              <span className={cn("font-bold", overCap ? "text-rose-600" : "text-amber-600 dark:text-amber-400")}>−₺{discAmt.toLocaleString("tr-TR")}</span>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 mb-2">
              <Lock className="w-3 h-3" /> {error}
            </p>
          )}

          <div className="flex items-center gap-1.5">
            <button
              onClick={apply}
              disabled={overCap}
              className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Uygula
            </button>
            {existing && (
              <button
                onClick={clear}
                title="İndirimi kaldır"
                className="px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-500/15 text-slate-500 hover:text-rose-600 text-xs font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TypeBtn({ active, onClick, icon: Icon, label, disabled }: {
  active: boolean; onClick: () => void; icon: typeof Percent; label: string; disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1 py-1.5 rounded-lg border text-[11px] font-bold transition-all",
        disabled
          ? "border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed"
          : active
            ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-amber-300",
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  )
}
