"use client"

import { useEffect, useRef, useState } from "react"
import { Percent, Banknote, Tag, X, Check, Trash2, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  RETAIL_DISCOUNT_REASON_LABELS, RETAIL_DISCOUNT_REASON_OPTIONS,
  effectiveUnitPrice, lineDiscountAmount,
  type CartLine, type RetailDiscountType, type RetailDiscountReason, type RetailLineDiscount,
} from "@/types/retail"

// ─── Retail line discount / price-override menu ──────────────────────────────
//
// Compact per-line action menu for the retail cart. Tools (gated by the owner's
// permissions):
//   • İndirim ₺ (fixed)  · İndirim % (percent)  · Manuel Fiyat (override)
//   • İndirimi Kaldır
//
// A reason is MANDATORY before a discount can be applied; "Diğer" reveals a
// required free-text field.

interface Props {
  line:        CartLine
  canDiscount: boolean   // may apply any discount at all
  canFixed:    boolean   // may apply a fixed ₺ discount
  canPercent:  boolean   // may apply a percentage discount
  canOverride: boolean   // may set a manual price
  maxDiscount: number    // ₺ cap per line for staff (0 = unlimited)
  onChange:    (discount: RetailLineDiscount | undefined) => void
}

export function RetailLineDiscountMenu({
  line, canDiscount, canFixed, canPercent, canOverride, maxDiscount, onChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // First permitted discount mode → the sensible default the picker opens on.
  const defaultType: RetailDiscountType =
    canFixed ? "fixed" : canPercent ? "percent" : "override"

  const existing = line.discount
  const [type,   setType]   = useState<RetailDiscountType>(existing?.type ?? defaultType)
  const [value,  setValue]  = useState<string>(existing ? String(existing.value) : "")
  // Reason is mandatory — no silent default. "" forces an explicit choice.
  const [reason, setReason] = useState<RetailDiscountReason | "">(existing?.reason ?? "")
  const [note,   setNote]   = useState<string>(existing?.note ?? "")
  const [error,  setError]  = useState<string | null>(null)

  // Re-seed the form whenever a different discount arrives (e.g. reopened line).
  useEffect(() => {
    if (!open) return
    setType(existing?.type ?? defaultType)
    setValue(existing ? String(existing.value) : "")
    setReason(existing?.reason ?? "")
    setNote(existing?.note ?? "")
    setError(null)
  }, [open, existing, defaultType])

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
  const previewReason: RetailDiscountReason = (reason || "other") as RetailDiscountReason
  const previewLine: CartLine = { ...line, discount: value ? { type, value: Number(value) || 0, reason: previewReason, note } : undefined }
  const finalUnit = effectiveUnitPrice(previewLine)
  const discAmt   = lineDiscountAmount(previewLine)
  const overCap   = maxDiscount > 0 && discAmt > maxDiscount

  function apply() {
    const v = Number(value)
    if (!value || !isFinite(v) || v < 0) { setError("Geçerli bir değer gir"); return }
    if (type === "fixed"    && !canFixed)    { setError("Sabit ₺ indirim yetkin yok"); return }
    if (type === "percent"  && !canPercent)  { setError("Yüzde indirim yetkin yok"); return }
    if (type === "override" && !canOverride) { setError("Manuel fiyat yetkin yok"); return }
    if (overCap) { setError(`Limit ₺${maxDiscount.toLocaleString("tr-TR")} — indirim çok yüksek`); return }
    // Reason is mandatory for every discount.
    if (!reason) { setError("İndirim sebebi seç (zorunlu)"); return }
    if (reason === "other" && !note.trim()) { setError("Sebep için not gir"); return }
    onChange({ type, value: v, reason, note: note.trim() || undefined })
    setOpen(false)
  }

  function clear() {
    onChange(undefined)
    setOpen(false)
  }

  const existingDiscAmt = existing ? lineDiscountAmount(line) : 0

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        title="İndirim / fiyat düzenle"
        className={cn(
          "inline-flex items-center gap-1 px-2 h-7 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-colors",
          existing
            ? "border-amber-300 dark:border-amber-500/40 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
            : "border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10",
        )}
      >
        <Tag className="w-3 h-3" />
        {existing ? `−₺${existingDiscAmt.toLocaleString("tr-TR")}` : "İndirim"}
      </button>

      {open && (
        // Fixed, centered modal — escapes the cart's overflow:auto clipping so
        // the whole form is always visible on any screen.
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150" />
          <div
            className="relative w-full max-w-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fiyat / İndirim</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{line.productName}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Type toggle — each mode gated by the owner's permission */}
          <div className="grid grid-cols-3 gap-1 mb-2">
            <TypeBtn active={type === "fixed"}    onClick={() => setType("fixed")}    icon={Banknote} label="₺" disabled={!canFixed} />
            <TypeBtn active={type === "percent"}  onClick={() => setType("percent")}  icon={Percent}  label="%" disabled={!canPercent} />
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

          {/* Reason — MANDATORY (no default; sale can't proceed without one) */}
          <select
            value={reason}
            onChange={(e) => { setReason(e.target.value as RetailDiscountReason | ""); setError(null) }}
            className={cn(
              "w-full px-2.5 py-2 mb-2 rounded-lg border bg-white dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:border-amber-500",
              reason ? "border-slate-200 dark:border-slate-700" : "border-amber-400 dark:border-amber-500/50",
            )}
          >
            <option value="">İndirim sebebi seç… (zorunlu)</option>
            {RETAIL_DISCOUNT_REASON_OPTIONS.map((k) => (
              <option key={k} value={k}>{RETAIL_DISCOUNT_REASON_LABELS[k]}</option>
            ))}
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
