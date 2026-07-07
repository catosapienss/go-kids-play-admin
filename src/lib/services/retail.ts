import { createClient } from "@/lib/supabase/client"
import {
  cartTotal, cartDiscountTotal, effectiveUnitPrice, lineTotal, lineDiscountAmount,
  retailDiscountCategory,
} from "@/types/retail"
import type {
  CartLine, DailyRevenueBreakdown, PaymentMethod, Product,
  RetailDayStats, RetailSaleListRow, RetailTodaySummary, RetailDiscountReason,
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
  // Effective totals — honour any per-line retail discount / price override.
  const total         = cartTotal(input.cart)
  const discountTotal = cartDiscountTotal(input.cart)

  // 1. Header row. `discount_total` only sent when the schema has it (migration
  //    021); we retry without it on a missing-column error so checkout never
  //    breaks during the deploy window.
  const headerBase = {
    cashier_id:     input.cashierId,
    payment_method: input.paymentMethod,
    total_amount:   total,
    cash_amount:    input.cashAmount,
    card_amount:    input.cardAmount,
    notes:          input.notes ?? null,
    parent_id:      input.parentId ?? null,
  }
  let saleRes = await supabase
    .from("retail_sales")
    .insert({ ...headerBase, discount_total: discountTotal })
    .select("id")
    .single()
  if (saleRes.error && isMissingColumn(saleRes.error, "discount_total")) {
    saleRes = await supabase.from("retail_sales").insert(headerBase).select("id").single()
  }
  if (saleRes.error || !saleRes.data) throw saleRes.error ?? new Error("Sale insert failed")
  const saleId = saleRes.data.id as string

  // 2. Line items — store original + effective price + discount metadata.
  const richItems = input.cart.map((l) => {
    const finalUnit = effectiveUnitPrice(l)
    return {
      sale_id:             saleId,
      product_id:          l.productId,
      product_name:        l.productName,
      quantity:            l.quantity,
      unit_price:          finalUnit,                 // effective (existing reports read this)
      line_total:          lineTotal(l),
      original_unit_price: l.unitPrice,
      discount_type:       l.discount?.type   ?? null,
      discount_value:      l.discount?.value  ?? null,
      final_unit_price:    finalUnit,
      discount_amount:     lineDiscountAmount(l),
      discount_reason:     l.discount?.reason ?? null,
      custom_note:         l.discount?.note   ?? null,
      applied_by:          l.discount ? input.cashierId : null,
    }
  })
  let itemsErr = (await supabase.from("retail_sale_items").insert(richItems)).error
  if (itemsErr && isMissingColumn(itemsErr, "original_unit_price")) {
    // Pre-migration fallback — insert the legacy shape (effective prices).
    const legacyItems = input.cart.map((l) => ({
      sale_id:      saleId,
      product_id:   l.productId,
      product_name: l.productName,
      quantity:     l.quantity,
      unit_price:   effectiveUnitPrice(l),
      line_total:   lineTotal(l),
    }))
    itemsErr = (await supabase.from("retail_sale_items").insert(legacyItems)).error
  }
  if (itemsErr) throw itemsErr

  return { saleId, total }
}

/** True when a PostgREST error is a missing-column / schema-cache miss. */
function isMissingColumn(err: { message?: string } | null, column: string): boolean {
  const msg = err?.message ?? ""
  return msg.includes(column) && (msg.includes("column") || msg.includes("schema cache"))
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

  // discount_total exists after migration 021; select("*") tolerates its
  // absence so the feed keeps working during the deploy window.
  const { data: sales, error } = await supabase
    .from("retail_sales")
    .select("*")
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
    discountTotal: Number((s as { discount_total?: number | string }).discount_total ?? 0),
    itemsLabel:    labelMap.get(s.id as string) ?? ((s.notes as string | null) ?? "Perakende"),
    itemCount:     countMap.get(s.id as string) ?? 0,
    notes:         (s.notes as string | null) ?? null,
  }))
}

/** Aggregate the day feed into the finance summary strip numbers. */
export function summariseRetailDay(rows: RetailSaleListRow[]): RetailDayStats {
  return rows.reduce<RetailDayStats>(
    (acc, r) => ({
      cashTotal:     acc.cashTotal     + r.cashAmount,
      cardTotal:     acc.cardTotal     + r.cardAmount,
      grandTotal:    acc.grandTotal    + r.totalAmount,
      itemsSold:     acc.itemsSold     + r.itemCount,
      saleCount:     acc.saleCount     + 1,
      discountTotal: acc.discountTotal + r.discountTotal,
    }),
    { cashTotal: 0, cardTotal: 0, grandTotal: 0, itemsSold: 0, saleCount: 0, discountTotal: 0 },
  )
}

// ─── Retail discount analytics (dashboard + reports) ─────────────────────────

export interface RetailDiscountBreakdown {
  totalSales:        number   // effective retail revenue (non-voided)
  totalDiscount:     number   // Σ discount given
  staffDiscount:     number   // reason category: staff / manager_approval
  promotionDiscount: number   // reason category: promotion / vip / campaign / loyalty
  otherDiscount:     number   // everything else (damaged, other, legacy)
  saleCount:         number   // all non-voided sales
  discountedLines:   number   // line items with a discount
  discountedSales:   number   // distinct sales that carried any discount
  /** Discount as a % of gross (final + discount). 0..100. */
  discountPct:       number
}

/**
 * Retail sales + discount breakdown for a date range. Read-only, tolerant of
 * the pre-021 schema (returns zero discounts). Powers the dashboard retail
 * analytics section and the reports discount view.
 */
export async function fetchRetailDiscountBreakdown(
  fromIso: string, toIso: string,
): Promise<RetailDiscountBreakdown> {
  const empty: RetailDiscountBreakdown = {
    totalSales: 0, totalDiscount: 0, staffDiscount: 0, promotionDiscount: 0,
    otherDiscount: 0, saleCount: 0, discountedLines: 0, discountedSales: 0, discountPct: 0,
  }
  try {
    const supabase = createClient()
    const { data: sales, error } = await supabase
      .from("retail_sales")
      .select("id, total_amount, voided")
      .gte("sold_at", fromIso)
      .lte("sold_at", toIso)
    if (error) throw error
    const live = (sales ?? []).filter((s) => !(s as { voided?: boolean }).voided)
    if (live.length === 0) return empty

    const out = { ...empty, saleCount: live.length }
    out.totalSales = live.reduce((s, r) => s + Number((r as { total_amount?: number }).total_amount ?? 0), 0)

    const ids = live.map((s) => s.id as string)
    const { data: items } = await supabase
      .from("retail_sale_items")
      .select("sale_id, discount_amount, discount_reason")
      .in("sale_id", ids)

    const discountedSaleIds = new Set<string>()
    for (const it of (items ?? []) as Array<{ sale_id?: string; discount_amount?: number | string | null; discount_reason?: string | null }>) {
      const amt = Number(it.discount_amount ?? 0)
      if (amt <= 0) continue
      out.discountedLines += 1
      out.totalDiscount += amt
      if (it.sale_id) discountedSaleIds.add(it.sale_id)
      const cat = retailDiscountCategory(it.discount_reason as RetailDiscountReason | null)
      if (cat === "staff") out.staffDiscount += amt
      else if (cat === "promotion") out.promotionDiscount += amt
      else out.otherDiscount += amt
    }
    out.discountedSales = discountedSaleIds.size
    // % of gross (final revenue + discount given).
    const gross = out.totalSales + out.totalDiscount
    out.discountPct = gross > 0 ? Math.round((out.totalDiscount / gross) * 1000) / 10 : 0
    return out
  } catch {
    return empty
  }
}

// ─── Retail discount history (reports) ──────────────────────────────────────

export interface RetailDiscountLine {
  id:                string
  soldAt:            string
  productName:       string
  quantity:          number
  originalUnitPrice: number
  finalUnitPrice:    number
  discountAmount:    number
  discountType:      string | null
  discountValue:     number | null
  reason:            string | null
  note:              string | null
  staffName:         string | null
}

/** Discounted retail lines in a date range, newest first — for the reports
 *  discount history. Never mutates; tolerant of the pre-021 schema. */
export async function listRetailDiscountLines(
  fromIso: string, toIso: string, limit = 100,
): Promise<RetailDiscountLine[]> {
  try {
    const supabase = createClient()
    const { data: sales, error } = await supabase
      .from("retail_sales")
      .select("id, sold_at, voided")
      .gte("sold_at", fromIso)
      .lte("sold_at", toIso)
      .order("sold_at", { ascending: false })
      .limit(500)
    if (error) throw error
    const live = (sales ?? []).filter((s) => !(s as { voided?: boolean }).voided)
    if (live.length === 0) return []
    const soldAtMap = new Map(live.map((s) => [s.id as string, s.sold_at as string]))

    const { data: items, error: iErr } = await supabase
      .from("retail_sale_items")
      .select("id, sale_id, product_name, quantity, original_unit_price, final_unit_price, unit_price, discount_amount, discount_type, discount_value, discount_reason, custom_note, applied_by")
      .in("sale_id", live.map((s) => s.id as string))
      .gt("discount_amount", 0)
      .limit(limit)
    if (iErr) throw iErr
    const rows = (items ?? []) as Array<Record<string, unknown>>
    if (rows.length === 0) return []

    // Resolve staff names.
    const staffIds = Array.from(new Set(rows.map((r) => r.applied_by).filter(Boolean))) as string[]
    const nameMap = new Map<string, string>()
    if (staffIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", staffIds)
      for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null }>) {
        if (p.full_name) nameMap.set(p.id, p.full_name)
      }
    }

    return rows
      .map((r): RetailDiscountLine => ({
        id:                r.id as string,
        soldAt:            soldAtMap.get(r.sale_id as string) ?? "",
        productName:       (r.product_name as string) ?? "Ürün",
        quantity:          Number(r.quantity ?? 1),
        originalUnitPrice: Number(r.original_unit_price ?? r.unit_price ?? 0),
        finalUnitPrice:    Number(r.final_unit_price ?? r.unit_price ?? 0),
        discountAmount:    Number(r.discount_amount ?? 0),
        discountType:      (r.discount_type as string | null) ?? null,
        discountValue:     r.discount_value != null ? Number(r.discount_value) : null,
        reason:            (r.discount_reason as string | null) ?? null,
        note:              (r.custom_note as string | null) ?? null,
        staffName:         r.applied_by ? (nameMap.get(r.applied_by as string) ?? null) : null,
      }))
      .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime())
  } catch {
    return []
  }
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
