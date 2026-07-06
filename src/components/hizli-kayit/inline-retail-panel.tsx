"use client"

import { useEffect, useState } from "react"
import { ShoppingBag, Minus, Plus, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { listProducts } from "@/lib/services/retail"
import {
  cartTotal, effectiveUnitPrice, lineTotal,
  RETAIL_DISCOUNT_REASON_LABELS,
  type CartLine, type Product, type RetailLineDiscount,
} from "@/types/retail"
import { RetailLineDiscountMenu } from "@/components/perakende/retail-line-discount"
import { useSettingsSection } from "@/lib/settings/settings-store"
import { useAuth } from "@/contexts/auth-context"

// ─── Inline Retail Panel (Section 4) ─────────────────────────────────────────
//
// Lets the operator add retail items (Çorap, Boyama Seti, Su, Oyuncak, …)
// during quick registration so the parent pays once, at the end. Reads the
// existing products table (read-only — listProducts performs a plain
// `select` on PostgREST). The selected line items become a cart that the
// parent page checkouts via the same `checkoutSale` service used by
// /perakende.

interface Props {
  cart:     CartLine[]
  onChange: (cart: CartLine[]) => void
}

export function InlineRetailPanel({ cart, onChange }: Props) {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [search,   setSearch]   = useState("")
  const [busy,     setBusy]     = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  // Owner-configured retail discount permissions (admin/manager always allowed).
  const { user } = useAuth()
  const limits = useSettingsSection("discounts")
  const isPrivileged = user?.role === "admin" || user?.role === "super_admin" || user?.role === "manager"
  const canDiscount  = isPrivileged || limits.retailDiscountEnabled
  const canOverride  = isPrivileged || limits.retailPriceOverride
  const maxDiscount  = isPrivileged ? 0 : (limits.retailMaxDiscount || 0)

  function setLineDiscount(productId: string, discount: RetailLineDiscount | undefined): void {
    onChange(cart.map((l) => l.productId === productId ? { ...l, discount } : l))
  }

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    listProducts({ onlyActive: true })
      .then((rows) => { if (!cancelled) setProducts(rows) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Ürün listesi yüklenemedi") })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [])

  function addLine(p: Product): void {
    const existing = cart.find((l) => l.productId === p.id)
    if (existing) {
      onChange(cart.map((l) => l.productId === p.id
        ? { ...l, quantity: l.quantity + 1 }
        : l))
      return
    }
    onChange([
      ...cart,
      { productId: p.id, productName: p.name, unitPrice: p.salePrice, quantity: 1 },
    ])
  }

  function setQty(productId: string, qty: number): void {
    if (qty <= 0) {
      onChange(cart.filter((l) => l.productId !== productId))
      return
    }
    onChange(cart.map((l) => l.productId === productId ? { ...l, quantity: qty } : l))
  }

  function removeLine(productId: string): void {
    onChange(cart.filter((l) => l.productId !== productId))
  }

  const cartSum   = cartTotal(cart)
  const filtered  = products
    ? products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Perakende</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {cart.length > 0 ? `${cart.reduce((s, l) => s + l.quantity, 0)} ürün` : "Ürün ekle (opsiyonel)"}
            </p>
          </div>
        </div>
        {cartSum > 0 && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Perakende toplamı</p>
            <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">
              ₺{cartSum.toLocaleString("tr-TR")}
            </p>
          </div>
        )}
      </div>

      {/* Cart lines */}
      {cart.length > 0 && (
        <div className="space-y-1.5">
          {cart.map((line) => {
            const eff = effectiveUnitPrice(line)
            const discounted = !!line.discount
            return (
              <div key={line.productId} className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200/60 dark:border-amber-500/15">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{line.productName}</p>
                  <p className="text-[10px] text-slate-500 tabular-nums">
                    {discounted ? (
                      <><s className="text-slate-400">₺{line.unitPrice.toLocaleString("tr-TR")}</s> <strong className="text-amber-700 dark:text-amber-400">₺{eff.toLocaleString("tr-TR")}</strong></>
                    ) : (
                      <>₺{line.unitPrice.toLocaleString("tr-TR")}</>
                    )}
                    {" · "}satır <strong>₺{lineTotal(line).toLocaleString("tr-TR")}</strong>
                  </p>
                  {discounted && (
                    <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 truncate">
                      {RETAIL_DISCOUNT_REASON_LABELS[line.discount!.reason]}
                      {line.discount!.note ? ` · ${line.discount!.note}` : ""}
                    </p>
                  )}
                </div>
                <RetailLineDiscountMenu
                  line={line}
                  canDiscount={canDiscount}
                  canOverride={canOverride}
                  maxDiscount={maxDiscount}
                  onChange={(d) => setLineDiscount(line.productId, d)}
                />
                <QtyStepper qty={line.quantity} onChange={(q) => setQty(line.productId, q)} />
                <button
                  onClick={() => removeLine(line.productId)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-500/15 flex items-center justify-center"
                  aria-label="Satırı sil"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Search + product chips */}
      {busy ? (
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : error ? (
        <p className="text-xs text-rose-500">{error}</p>
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün ara..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-amber-500"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
            {filtered.slice(0, 24).map((p) => (
              <button
                key={p.id}
                onClick={() => addLine(p)}
                className="text-left rounded-xl px-2.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
              >
                <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold tabular-nums">
                  ₺{p.salePrice.toLocaleString("tr-TR")}
                </p>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-3 text-xs text-slate-400 text-center py-2">
                {products && products.length === 0 ? "Hiç aktif ürün yok" : "Aramaya uyan ürün yok"}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function QtyStepper({ qty, onChange }: { qty: number; onChange: (q: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <StepBtn icon={Minus} onClick={() => onChange(qty - 1)} />
      <span className="px-2 text-xs font-bold tabular-nums w-7 text-center">{qty}</span>
      <StepBtn icon={Plus} onClick={() => onChange(qty + 1)} />
    </div>
  )
}

function StepBtn({ icon: Icon, onClick }: { icon: typeof Plus; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white">
      <Icon className="w-3 h-3" />
    </button>
  )
}
