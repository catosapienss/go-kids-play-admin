import { createClient } from "@/lib/supabase/client"
import type {
  CartLine, DailyRevenueBreakdown, PaymentMethod, Product,
  RetailDayStats, RetailSaleListRow, RetailTodaySummary,
} from "@/types/retail"

// ─── Retail service ──────────────────────────────────────────────────────────

export async function listProducts(opts?: { onlyActive?: boolean }): Promise<Product[]> {
  const supabase = createClient()
  let q = supabase
    .from("products")
    .select("id, name, category, sale_price, cost_price, sku, stock_on_hand, is_active, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (opts?.onlyActive) q = q.eq("is_active", true)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => ({
    id:           r.id as string,
    name:         (r.name as string) ?? "",
    category:     ((r.category as string) ?? "genel") as Product["category"],
    salePrice:    Number(r.sale_price ?? 0),
    costPrice:    r.cost_price !== null && r.cost_price !== undefined ? Number(r.cost_price) : null,
    sku:          (r.sku as string | null) ?? null,
    stockOnHand:  Number(r.stock_on_hand ?? 0),
    isActive:     (r.is_active as boolean) ?? true,
    sortOrder:    Number(r.sort_order ?? 0),
  }))
}

export async function createProduct(p: {
  name: string; category: string; salePrice: number; isActive: boolean
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("products").insert({
    name:       p.name,
    category:   p.category,
    sale_price: p.salePrice,
    is_active:  p.isActive,
  })
  if (error) throw error
}

export async function updateProduct(id: string, p: Partial<{
  name: string; category: string; salePrice: number; isActive: boolean
}>): Promise<void> {
  const supabase = createClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (p.name        !== undefined) patch.name = p.name
  if (p.category    !== undefined) patch.category = p.category
  if (p.salePrice   !== undefined) patch.sale_price = p.salePrice
  if (p.isActive    !== undefined) patch.is_active = p.isActive
  const { error } = await supabase.from("products").update(patch).eq("id", id)
  if (error) throw error
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) throw error
}

// ─── Sale checkout ───────────────────────────────────────────────────────────

export async function checkoutSale(input: {
  cashierId: string
  cart: CartLine[]
  paymentMethod: PaymentMethod
  cashAmount: number
  cardAmount: number
  notes?: string
  /** Optional — link the sale to a parent so it shows up in that
   *  customer's activity timeline. */
  parentId?: string
}): Promise<{ saleId: string; total: number }> {
  const supabase = createClient()
  const total = input.cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0)

  // 1. Header row
  const { data: sale, error: saleErr } = await supabase
    .from("retail_sales")
    .insert({
      cashier_id:     input.cashierId,
      payment_method: input.paymentMethod,
      total_amount:   total,
      cash_amount:    input.cashAmount,
      card_amount:    input.cardAmount,
      notes:          input.notes ?? null,
      parent_id:      input.parentId ?? null,
    })
    .select("id")
    .single()
  if (saleErr || !sale) throw saleErr ?? new Error("Sale insert failed")

  // 2. Line items
  const items = input.cart.map((l) => ({
    sale_id:      sale.id,
    product_id:   l.productId,
    product_name: l.productName,
    quantity:     l.quantity,
    unit_price:   l.unitPrice,
    line_total:   l.unitPrice * l.quantity,
  }))
  const { error: itemsErr } = await supabase.from("retail_sale_items").insert(items)
  if (itemsErr) throw itemsErr

  return { saleId: sale.id as string, total }
}

// ─── Day feed + finance summary (staff-visible, plain selects w/ RLS) ────────

function todayStartIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * Today's sales, newest first, with a compact per-sale item label
 * ("Çorap × 2 · Su × 1") and the tender split. Powers both the sales feed
 * and the finance summary strip on /perakende — one pair of reads, no RPC,
 * so it works for every authenticated role.
 */
export async function listTodayRetailSales(): Promise<RetailSaleListRow[]> {
  const supabase = createClient()

  const { data: sales, error } = await supabase
    .from("retail_sales")
    .select("id, sold_at, payment_method, total_amount, cash_amount, card_amount, notes, voided")
    .gte("sold_at", todayStartIso())
    .order("sold_at", { ascending: false })
    .limit(300)
  if (error) throw error

  const live = (sales ?? []).filter((s) => !(s.voided as boolean))
  if (live.length === 0) return []

  const ids = live.map((s) => s.id as string)
  const { data: items } = await supabase
    .from("retail_sale_items")
    .select("sale_id, product_name, quantity")
    .in("sale_id", ids)

  const labelMap = new Map<string, string>()
  const countMap = new Map<string, number>()
  for (const it of (items ?? []) as Array<{ sale_id: string; product_name: string | null; quantity: number | string | null }>) {
    const qty = Number(it.quantity ?? 1) || 1
    const name = (it.product_name ?? "Ürün").trim() || "Ürün"
    const label = qty > 1 ? `${name} × ${qty}` : name
    const prev = labelMap.get(it.sale_id)
    labelMap.set(it.sale_id, prev ? `${prev} · ${label}` : label)
    countMap.set(it.sale_id, (countMap.get(it.sale_id) ?? 0) + qty)
  }

  return live.map((s): RetailSaleListRow => ({
    id:            s.id as string,
    soldAt:        s.sold_at as string,
    paymentMethod: (s.payment_method as PaymentMethod) ?? "cash",
    totalAmount:   Number(s.total_amount ?? 0),
    cashAmount:    Number(s.cash_amount ?? 0),
    cardAmount:    Number(s.card_amount ?? 0),
    itemsLabel:    labelMap.get(s.id as string) ?? ((s.notes as string | null) ?? "Perakende"),
    itemCount:     countMap.get(s.id as string) ?? 0,
    notes:         (s.notes as string | null) ?? null,
  }))
}

/** Aggregate the day feed into the finance summary strip numbers. */
export function summariseRetailDay(rows: RetailSaleListRow[]): RetailDayStats {
  return rows.reduce<RetailDayStats>(
    (acc, r) => ({
      cashTotal:  acc.cashTotal  + r.cashAmount,
      cardTotal:  acc.cardTotal  + r.cardAmount,
      grandTotal: acc.grandTotal + r.totalAmount,
      itemsSold:  acc.itemsSold  + r.itemCount,
      saleCount:  acc.saleCount  + 1,
    }),
    { cashTotal: 0, cardTotal: 0, grandTotal: 0, itemsSold: 0, saleCount: 0 },
  )
}

// ─── Reporting RPCs ──────────────────────────────────────────────────────────

export async function fetchRetailTodaySummary(): Promise<RetailTodaySummary | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("retail_today_summary")
  if (error) {
    console.warn("[retail] today_summary rpc error", error)
    return null
  }
  return data as RetailTodaySummary
}

export async function fetchDailyRevenueBreakdown(date?: string): Promise<DailyRevenueBreakdown | null> {
  const supabase = createClient()
  const args = date ? { p_date: date } : {}
  const { data, error } = await supabase.rpc("daily_revenue_breakdown", args)
  if (error) {
    console.warn("[retail] daily_revenue_breakdown rpc error", error)
    return null
  }
  return data as DailyRevenueBreakdown
}
