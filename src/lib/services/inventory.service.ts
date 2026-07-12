import { createClient } from "@/lib/supabase/client"

// ─── Inventory / Stock service (manager-only writes) ─────────────────────────
//
// products.stock_on_hand is the live quantity; sales & waste decrement it via
// DB triggers. Managers restock and run monthly physical counts. Reads are
// tolerant of the pre-027 schema (return empty / 0).

export interface StockProduct {
  id: string
  name: string
  category: string
  salePrice: number
  stockOnHand: number
  minStock: number
  isActive: boolean
}

export interface StockInvoiceRow {
  id: string
  supplierName: string | null
  invoiceNo: string | null
  note: string | null
  totalCost: number
  itemCount: number
  createdByName: string | null
  createdAt: string
}

export interface StockInvoiceItem {
  productId: string | null
  productName: string
  quantity: number
  unitCost: number
  lineCost: number
}

export interface StockMovementRow {
  id: string
  productName: string
  movementType: string
  delta: number
  reason: string | null
  createdAt: string
}

export interface InvoiceLineInput {
  productId: string
  productName: string
  quantity: number
  unitCost: number
}

export interface StockCountItem {
  id: string
  productId: string | null
  productName: string
  systemQty: number
  countedQty: number | null
}

export interface StockCount {
  id: string
  status: "open" | "completed"
  startedByName: string | null
  note: string | null
  startedAt: string
  completedAt: string | null
}

export async function listStockProducts(): Promise<StockProduct[]> {
  try {
    const supabase = createClient()
    // min_stock exists after migration 032 — select("*") tolerates its absence.
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("stock_on_hand", { ascending: true })
      .order("name", { ascending: true })
    if (error) throw error
    return (data ?? []).map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? "",
      category: (r.category as string) ?? "genel",
      salePrice: Number(r.sale_price ?? 0),
      stockOnHand: Number(r.stock_on_hand ?? 0),
      minStock: Number((r as { min_stock?: number }).min_stock ?? 0),
      isActive: (r.is_active as boolean) ?? true,
    }))
  } catch { return [] }
}

/** Set a product's minimum-stock threshold (drives low-stock alerts). */
export async function setMinStock(productId: string, min: number): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("products").update({ min_stock: Math.max(0, Math.round(min)) }).eq("id", productId)
  if (error) throw error
}

// ─── Invoice-based stock entry ───────────────────────────────────────────────

/** Record a supplier purchase invoice → increments stock atomically. Manager+. */
export async function recordStockInvoice(input: {
  supplier?: string; invoiceNo?: string; note?: string; items: InvoiceLineInput[]
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("record_stock_invoice", {
    p_supplier:   input.supplier ?? null,
    p_invoice_no: input.invoiceNo ?? null,
    p_note:       input.note ?? null,
    p_items:      input.items.map((l) => ({
      product_id: l.productId, product_name: l.productName, quantity: l.quantity, unit_cost: l.unitCost,
    })),
  })
  if (error) {
    if (error.message?.includes("not_authorized")) throw new Error("Bu işlem için yönetici yetkisi gerekli")
    throw error
  }
  return data as string
}

export async function listStockInvoices(limit = 50): Promise<StockInvoiceRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("stock_invoices").select("*")
      .order("created_at", { ascending: false }).limit(limit)
    if (error) throw error
    return (data ?? []).map((r) => ({
      id: r.id as string,
      supplierName: (r.supplier_name as string | null) ?? null,
      invoiceNo: (r.invoice_no as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      totalCost: Number(r.total_cost ?? 0),
      itemCount: Number(r.item_count ?? 0),
      createdByName: (r.created_by_name as string | null) ?? null,
      createdAt: r.created_at as string,
    }))
  } catch { return [] }
}

export async function getInvoiceItems(invoiceId: string): Promise<StockInvoiceItem[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("stock_invoice_items")
      .select("product_id, product_name, quantity, unit_cost, line_cost")
      .eq("invoice_id", invoiceId)
    if (error) throw error
    return (data ?? []).map((r) => ({
      productId: (r.product_id as string | null) ?? null,
      productName: (r.product_name as string) ?? "",
      quantity: Number(r.quantity ?? 0),
      unitCost: Number(r.unit_cost ?? 0),
      lineCost: Number(r.line_cost ?? 0),
    }))
  } catch { return [] }
}

// ─── Reports: movements + sold today/month ───────────────────────────────────

export async function listStockMovements(limit = 100): Promise<StockMovementRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("stock_movements")
      .select("id, movement_type, delta, reason, created_at, products(name)")
      .order("created_at", { ascending: false }).limit(limit)
    if (error) throw error
    return (data ?? []).map((r) => {
      const prod = (r as { products?: { name?: string } | { name?: string }[] }).products
      const name = Array.isArray(prod) ? prod[0]?.name : prod?.name
      return {
        id: r.id as string,
        productName: name ?? "—",
        movementType: (r.movement_type as string) ?? "",
        delta: Number(r.delta ?? 0),
        reason: (r.reason as string | null) ?? null,
        createdAt: r.created_at as string,
      }
    })
  } catch { return [] }
}

/** Units sold today + this month (from non-voided retail sales — source of truth). */
export async function getSoldCounts(): Promise<{ today: number; month: number }> {
  try {
    const supabase = createClient()
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { data: sales } = await supabase
      .from("retail_sales").select("id, sold_at, voided")
      .gte("sold_at", monthStart)
    const live = (sales ?? []).filter((s) => !(s as { voided?: boolean }).voided)
    if (live.length === 0) return { today: 0, month: 0 }
    const soldAt = new Map(live.map((s) => [s.id as string, s.sold_at as string]))
    const { data: items } = await supabase
      .from("retail_sale_items").select("sale_id, quantity")
      .in("sale_id", live.map((s) => s.id as string))
    let today = 0, month = 0
    for (const it of (items ?? []) as Array<{ sale_id: string; quantity: number | string }>) {
      const qty = Number(it.quantity ?? 0)
      const at = soldAt.get(it.sale_id)
      if (!at) continue
      month += qty
      if (at >= dayStart) today += qty
    }
    return { today, month }
  } catch { return { today: 0, month: 0 } }
}

/** Restock (+) or manual adjust (±) a product. Manager-only (enforced in RPC). */
export async function adjustStock(productId: string, delta: number, type: "restock" | "manual" = "restock", reason?: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId, p_delta: delta, p_type: type, p_reason: reason ?? null,
  })
  if (error) throw error
}

// ─── Monthly physical count ──────────────────────────────────────────────────

export async function getOpenStockCount(): Promise<StockCount | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("stock_counts").select("*")
      .eq("status", "open").order("started_at", { ascending: false }).limit(1).maybeSingle()
    if (error || !data) return null
    return mapCount(data as Record<string, unknown>)
  } catch { return null }
}

export async function startStockCount(note?: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("start_stock_count", { p_note: note ?? null })
  if (error) throw error
  return data as string
}

export async function getStockCountItems(countId: string): Promise<StockCountItem[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("stock_count_items")
      .select("id, product_id, product_name, system_qty, counted_qty")
      .eq("count_id", countId)
      .order("product_name", { ascending: true })
    if (error) throw error
    return (data ?? []).map((r) => ({
      id: r.id as string,
      productId: (r.product_id as string | null) ?? null,
      productName: (r.product_name as string) ?? "",
      systemQty: Number(r.system_qty ?? 0),
      countedQty: r.counted_qty == null ? null : Number(r.counted_qty),
    }))
  } catch { return [] }
}

export async function setCountItemQty(itemId: string, countedQty: number | null): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("stock_count_items")
    .update({ counted_qty: countedQty })
    .eq("id", itemId)
  if (error) throw error
}

export async function applyStockCount(countId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("apply_stock_count", { p_count_id: countId })
  if (error) throw error
}

export async function listCompletedCounts(limit = 12): Promise<StockCount[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("stock_counts").select("*")
      .eq("status", "completed").order("completed_at", { ascending: false }).limit(limit)
    if (error) throw error
    return (data ?? []).map((r) => mapCount(r as Record<string, unknown>))
  } catch { return [] }
}

function mapCount(r: Record<string, unknown>): StockCount {
  return {
    id: r.id as string,
    status: (r.status as "open" | "completed") ?? "open",
    startedByName: (r.started_by_name as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    startedAt: r.started_at as string,
    completedAt: (r.completed_at as string | null) ?? null,
  }
}
