"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Plus, Minus, Trash2, Banknote, CreditCard, Layers, Loader2, ShoppingBag,
  CheckCircle2, AlertCircle, X,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { listProducts, checkoutSale } from "@/lib/services/retail"
import {
  PAYMENT_METHOD_LABELS, PRODUCT_CATEGORY_LABELS, PRODUCT_CATEGORY_COLORS,
  RETAIL_DISCOUNT_REASON_LABELS,
  cartTotal, cartDiscountTotal, effectiveUnitPrice, lineTotal,
} from "@/types/retail"
import type { CartLine, PaymentMethod, Product, RetailLineDiscount } from "@/types/retail"
import { RetailLineDiscountMenu } from "@/components/perakende/retail-line-discount"
import { useSettingsSection } from "@/lib/settings/settings-store"
import { cn } from "@/lib/utils"

// ─── Quick Sale ──────────────────────────────────────────────────────────────
//
// Speed-first cashier UI:
//   1. Tap a product card → adds 1 to the cart (or +1 if already there).
//   2. Adjust quantity inline OR remove with the trash icon.
//   3. Pick payment method (Nakit / Kart / Karma). Karma asks for the cash
//      portion; card portion is auto-computed.
//   4. Tap "Satışı Tamamla" → server INSERTs into retail_sales + items,
//      cart resets, toast confirms.
//
// Whole flow can be completed in under 5 seconds for a single item.

const fmt = (n: number) => `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 0 })}`

interface QuickSaleProps {
  /** Fired after every successful checkout — lets the page refresh the
   *  day-summary panel without a reload. */
  onSaleComplete?: () => void
}

export function QuickSale({ onSaleComplete }: QuickSaleProps = {}) {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [payment, setPayment] = useState<PaymentMethod>("cash")
  const [cashAmount, setCashAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<string>("all")
  const [lastSale, setLastSale] = useState<{ saleId: string; total: number } | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const rows = await listProducts({ onlyActive: true })
      setProducts(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const total = useMemo(() => cartTotal(cart), [cart])
  const discountTotal = useMemo(() => cartDiscountTotal(cart), [cart])

  // Owner-configured retail discount permissions (admin/manager always allowed).
  const limits = useSettingsSection("discounts")
  const isPrivileged = user?.role === "admin" || user?.role === "super_admin" || user?.role === "manager"
  const canDiscount  = isPrivileged || limits.retailDiscountEnabled
  const canOverride  = isPrivileged || limits.retailPriceOverride
  const canFixed     = canDiscount && (isPrivileged || limits.retailAllowFixed)
  const canPercent   = canDiscount && (isPrivileged || limits.retailAllowPercentage)
  const maxDiscount  = isPrivileged ? 0 : (limits.retailMaxDiscount || 0)

  function setLineDiscount(productId: string, discount: RetailLineDiscount | undefined): void {
    setCart((prev) => prev.map((l) => l.productId === productId ? { ...l, discount } : l))
  }

  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => set.add(p.category))
    return ["all", ...Array.from(set)]
  }, [products])

  const visibleProducts = filter === "all"
    ? products
    : products.filter((p) => p.category === filter)

  // ── cart ops ──────────────────────────────────────────────────────────────

  function addToCart(p: Product) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, { productId: p.id, productName: p.name, unitPrice: p.salePrice, quantity: 1 }]
    })
  }

  function bumpQty(id: string, delta: number) {
    setCart((prev) => prev
      .map((l) => l.productId === id ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l))
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.productId !== id))
  }

  function resetCart() {
    setCart([]); setCashAmount(""); setPayment("cash")
  }

  // ── checkout ──────────────────────────────────────────────────────────────

  async function submit() {
    if (!user) { toast.error("Oturum bulunamadı"); return }
    if (cart.length === 0) { toast.error("Sepet boş"); return }

    let cashPart = 0
    let cardPart = 0
    if (payment === "cash") cashPart = total
    else if (payment === "card") cardPart = total
    else {
      const c = Number(cashAmount)
      if (!Number.isFinite(c) || c <= 0 || c >= total) {
        toast.error("Nakit kısmı 1 – toplam arası olmalı")
        return
      }
      cashPart = c
      cardPart = total - c
    }

    setSubmitting(true)
    try {
      const result = await checkoutSale({
        cashierId:     user.id,
        cart,
        paymentMethod: payment,
        cashAmount:    cashPart,
        cardAmount:    cardPart,
      })
      setLastSale(result)
      resetCart()
      toast.success(`Satış tamamlandı · ${fmt(result.total)}`)
      onSaleComplete?.()
    } catch (e) {
      toast.error("Satış kaydedilemedi: " + (e instanceof Error ? e.message.slice(0, 120) : "Bilinmeyen hata"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-4">
      {/* ── Products grid ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Ürünler</h2>
          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn(
                  "text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors",
                  filter === c
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700",
                )}
              >
                {c === "all" ? "Tümü" : PRODUCT_CATEGORY_LABELS[c as keyof typeof PRODUCT_CATEGORY_LABELS] ?? c}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {!loading && !error && visibleProducts.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-12 text-center text-sm text-slate-500">
            <ShoppingBag className="w-8 h-8 mx-auto mb-3 opacity-40" />
            Bu kategoride aktif ürün yok.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {visibleProducts.map((p) => {
            const inCart = cart.find((l) => l.productId === p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                className={cn(
                  "group relative rounded-2xl border bg-white dark:bg-slate-900 p-3 text-left transition-all hover:-translate-y-0.5",
                  inCart
                    ? "border-violet-400 dark:border-violet-500/50 shadow-md shadow-violet-500/10"
                    : "border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-500/40",
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                    PRODUCT_CATEGORY_COLORS[p.category],
                  )}>
                    {PRODUCT_CATEGORY_LABELS[p.category]}
                  </span>
                  {inCart && (
                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/20 px-1.5 py-0.5 rounded-full">
                      × {inCart.quantity}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight mb-1.5">
                  {p.name}
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                  {fmt(p.salePrice)}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Cart + checkout panel ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col h-fit lg:sticky lg:top-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" />
          Sepet
          {cart.length > 0 && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {cart.length} ürün
            </span>
          )}
        </h2>

        {lastSale && cart.length === 0 && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-200 flex items-start gap-2 mb-3 relative">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold">Son satış: {fmt(lastSale.total)}</p>
              <p className="opacity-70 mt-0.5">Yeni satışa başlayabilirsiniz.</p>
            </div>
            <button onClick={() => setLastSale(null)} className="opacity-50 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {cart.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Ürün eklemek için kart tıklayın.
          </div>
        ) : (
          <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
            {cart.map((l) => {
              const eff = effectiveUnitPrice(l)
              const discounted = !!l.discount
              return (
                <div key={l.productId} className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {l.productName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {discounted ? (
                        <><s className="text-slate-400">{fmt(l.unitPrice)}</s> <strong className="text-amber-700 dark:text-amber-400">{fmt(eff)}</strong> × {l.quantity}</>
                      ) : (
                        <>{fmt(l.unitPrice)} × {l.quantity}</>
                      )}
                    </p>
                    {discounted && (
                      <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 truncate">
                        {RETAIL_DISCOUNT_REASON_LABELS[l.discount!.reason]}
                        {l.discount!.note ? ` · ${l.discount!.note}` : ""}
                      </p>
                    )}
                  </div>
                  <RetailLineDiscountMenu
                    line={l}
                    canDiscount={canDiscount}
                    canFixed={canFixed}
                    canPercent={canPercent}
                    canOverride={canOverride}
                    maxDiscount={maxDiscount}
                    onChange={(d) => setLineDiscount(l.productId, d)}
                  />
                  <div className="flex items-center gap-1">
                    <button onClick={() => bumpQty(l.productId, -1)} className="p-1 rounded-md bg-white dark:bg-slate-700 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center tabular-nums">{l.quantity}</span>
                    <button onClick={() => bumpQty(l.productId, +1)} className="p-1 rounded-md bg-white dark:bg-slate-700 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-sm font-bold tabular-nums w-16 text-right">
                    {fmt(lineTotal(l))}
                  </div>
                  <button onClick={() => removeLine(l.productId)} className="p-1 text-slate-400 hover:text-rose-500" aria-label="Kaldır">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Payment summary — always reflects the real charge */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mb-3 space-y-1">
          {discountTotal > 0 && (
            <>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-500 font-semibold">Perakende Toplam</span>
                <span className="text-slate-600 dark:text-slate-300 font-semibold tabular-nums">{fmt(total + discountTotal)}</span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-amber-600 dark:text-amber-400 font-semibold">Perakende İndirim</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">−{fmt(discountTotal)}</span>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between pt-0.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{discountTotal > 0 ? "Genel Toplam" : "Toplam"}</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{fmt(total)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <PaymentBtn active={payment === "cash"}  onClick={() => setPayment("cash")}  icon={<Banknote className="w-3.5 h-3.5" />} label={PAYMENT_METHOD_LABELS.cash} />
          <PaymentBtn active={payment === "card"}  onClick={() => setPayment("card")}  icon={<CreditCard className="w-3.5 h-3.5" />} label={PAYMENT_METHOD_LABELS.card} />
          <PaymentBtn active={payment === "split"} onClick={() => setPayment("split")} icon={<Layers     className="w-3.5 h-3.5" />} label={PAYMENT_METHOD_LABELS.split} />
        </div>

        {payment === "split" && (
          <div className="mb-3 space-y-2 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/[0.04] p-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Nakit kısmı (₺)
              </label>
              <input
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="Örn. 100"
                min={0}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
              />
            </div>
            <div className="text-xs text-slate-500 flex justify-between">
              <span>Kart kısmı:</span>
              <span className="font-mono tabular-nums">{fmt(Math.max(0, total - (Number(cashAmount) || 0)))}</span>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={submit}
          disabled={submitting || cart.length === 0}
          className={cn(
            "w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all",
            cart.length === 0 || submitting
              ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
              : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/25",
          )}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {submitting ? "Kaydediliyor…" : "Satışı Tamamla"}
        </button>
      </div>
    </div>
  )
}

function PaymentBtn({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all",
        active
          ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300"
          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700",
      )}
    >
      {icon}
      {label}
    </button>
  )
}
