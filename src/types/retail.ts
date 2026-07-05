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

export interface CartLine {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
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
  cashTotal:  number
  cardTotal:  number
  grandTotal: number
  itemsSold:  number    // Σ quantity across all line items
  saleCount:  number    // number of (non-voided) sales
}

/** One row of the day's sales feed (newest first). */
export interface RetailSaleListRow {
  id:            string
  soldAt:        string          // ISO
  paymentMethod: PaymentMethod
  totalAmount:   number
  cashAmount:    number
  cardAmount:    number
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
