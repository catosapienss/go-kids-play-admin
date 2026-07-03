import { createClient } from "@/lib/supabase/client"
import type {
  CartLine, DailyRevenueBreakdown, PaymentMethod, Product, RetailTodaySummary,
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
