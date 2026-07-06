// ─── Retail / POS types ──────────────────────────────────────────────────────

export type ProductCategory =
  | "corap"
  | "boyama"
  | "oyuncak"
  | "atistirmalik"
  | "icecek"
  | "genel"

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  corap:         "Çorap",
  boyama:        "Boyama",
  oyuncak:       "Oyuncak",
  atistirmalik:  "Atıştırmalık",
  icecek:        "İçecek",
  genel:         "Genel",
}

export const PRODUCT_CATEGORY_COLORS: Record<ProductCategory, string> = {
  corap:        "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  boyama:       "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
  oyuncak:      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  atistirmalik: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  icecek:       "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  genel:        "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
}

export interface Product {
  id: string
  name: string
  category: ProductCategory
  salePrice: number
  costPrice: number | null
  sku: string | null
  stockOnHand: number
  isActive: boolean
  sortOrder: number
}

export type PaymentMethod = "cash" | "card" | "split"

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:  "Nakit",
  card:  "Kart",
  split: "Karma",
}

// ─── Retail discount / price-override model ──────────────────────────────────
//
// Discounts apply ONLY to retail products, never to play sessions. The product's
// list price (`unitPrice`) is NEVER mutated — the discount is a per-line
// transaction override. Three methods:
//   • fixed    → ₺ off the unit price        (₺250 − ₺50 = ₺200)
//   • percent  → % off the unit price        (₺200 − 10% = ₺180)
//   • override → sell at a custom unit price  (₺250 → ₺200)

export type RetailDiscountType = "fixed" | "percent" | "override"

export type RetailDiscountReason =
  | "staff" | "customer" | "promotion" | "vip"
  | "manager_approval" | "damaged" | "manual" | "other"

export const RETAIL_DISCOUNT_REASON_LABELS: Record<RetailDiscountReason, string> = {
  staff:            "Personel İndirimi",
  customer:         "Müşteri İndirimi",
  promotion:        "Promosyon",
  vip:              "VIP Müşteri",
  manager_approval: "Yönetici Onayı",
  damaged:          "Hasarlı Paket",
  manual:           "Manuel Düzenleme",
  other:            "Diğer",
}

/** Broad category used for dashboard grouping (staff vs promo vs other). */
export function retailDiscountCategory(reason: RetailDiscountReason | null | undefined):
  "staff" | "promotion" | "other" {
  if (reason === "staff" || reason === "manager_approval") return "staff"
  if (reason === "promotion" || reason === "vip")          return "promotion"
  return "other"
}

export interface RetailLineDiscount {
  type:   RetailDiscountType
  value:  number                    // ₺ off/unit, %, or the override unit price
  reason: RetailDiscountReason
  note?:  string                    // free text (required-ish when reason==="other")
}

export interface CartLine {
  productId: string
  productName: string
  unitPrice: number                 // ORIGINAL list price — never mutated
  quantity: number
  discount?: RetailLineDiscount     // optional per-line discount / override
}

// ─── Money math (single source of truth for retail totals) ──────────────────

function round2(n: number): number { return Math.round(n * 100) / 100 }

/** Effective unit price after any discount/override. Clamped to ≥ 0. */
export function effectiveUnitPrice(line: CartLine): number {
  const base = line.unitPrice
  const d = line.discount
  if (!d) return round2(base)
  if (d.type === "override") return round2(Math.max(0, d.value))
  if (d.type === "percent") {
    const pct = Math.min(100, Math.max(0, d.value))
    return round2(Math.max(0, base * (1 - pct / 100)))
  }
  // fixed ₺ off per unit
  return round2(Math.max(0, base - Math.max(0, d.value)))
}

/** Final charged total for a line (effective unit price × quantity). */
export function lineTotal(line: CartLine): number {
  return round2(effectiveUnitPrice(line) * line.quantity)
}

/** ₺ discounted on a line vs the original list price. */
export function lineDiscountAmount(line: CartLine): number {
  return round2((line.unitPrice - effectiveUnitPrice(line)) * line.quantity)
}

/** Sum of final line totals across the cart. */
export function cartTotal(cart: CartLine[]): number {
  return round2(cart.reduce((s, l) => s + lineTotal(l), 0))
}

/** Sum of ₺ discounted across the cart. */
export function cartDiscountTotal(cart: CartLine[]): number {
  return round2(cart.reduce((s, l) => s + lineDiscountAmount(l), 0))
}

export interface RetailSaleInsert {
  payment_method: PaymentMethod
  total_amount: number
  cash_amount: number
  card_amount: number
  cashier_id: string
  notes?: string | null
}

export interface RetailSaleItemInsert {
  sale_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

/** Day-level finance summary shown to ALL staff on /perakende. */
export interface RetailDayStats {
  cashTotal:     number
  cardTotal:     number
  grandTotal:    number
  itemsSold:     number    // Σ quantity across all line items
  saleCount:     number    // number of (non-voided) sales
  discountTotal: number    // Σ retail discount given today
}

/** One row of the day's sales feed (newest first). */
export interface RetailSaleListRow {
  id:            string
  soldAt:        string          // ISO
  paymentMethod: PaymentMethod
  totalAmount:   number
  cashAmount:    number
  cardAmount:    number
  discountTotal: number          // ₺ discounted on this sale
  itemsLabel:    string          // "Çorap × 2 · Su × 1"
  itemCount:     number          // Σ quantity in this sale
  notes:         string | null
}

export interface RetailTodaySummary {
  totals: {
    total_revenue: number
    cash_revenue: number
    card_revenue: number
    tx_count: number
  }
  top_items: { product_id: string; product_name: string; qty: number; revenue: number }[]
}

export interface DailyRevenueBreakdown {
  date:         string
  sessions:     number
  retail:       number
  memberships:  number
  birthdays:    number
  total:        number
}
