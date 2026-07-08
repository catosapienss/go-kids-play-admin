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
  isActive: boolean
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
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, sale_price, stock_on_hand, is_active")
      .order("stock_on_hand", { ascending: true })
      .order("name", { ascending: true })
    if (error) throw error
    return (data ?? []).map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? "",
      category: (r.category as string) ?? "genel",
      salePrice: Number(r.sale_price ?? 0),
      stockOnHand: Number(r.stock_on_hand ?? 0),
      isActive: (r.is_active as boolean) ?? true,
    }))
  } catch { return [] }
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
