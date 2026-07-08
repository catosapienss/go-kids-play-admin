import { createClient } from "@/lib/supabase/client"
import { recordAudit } from "@/lib/reliability/audit-log"
import {
  dbRowToWaste, WASTE_REASON_LABELS,
  type RetailWaste, type DbRetailWasteRow, type WasteReason, type WasteReport,
  type WasteReasonSlice, type WasteProductSlice,
} from "@/types/retail-waste"

// ─── Retail Waste / Loss (Zayiat) service ────────────────────────────────────
//
// Independent loss ledger. Reads are tolerant of the table not existing yet
// (returns empty) so the UI keeps rendering before migration 026 runs.

const COLS = "id, product_id, product_name, quantity, unit_cost, total_cost, reason, note, created_by, created_by_name, created_at"

function round2(n: number): number { return Math.round(n * 100) / 100 }
function todayStartIso(): string { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }

export interface CreateWasteInput {
  productId:     string | null
  productName:   string
  quantity:      number
  unitCost:      number
  reason:        WasteReason
  note?:         string | null
  createdBy:     string
  createdByName?: string | null
}

export async function createWaste(input: CreateWasteInput): Promise<RetailWaste> {
  const supabase = createClient()
  const totalCost = round2(Math.max(0, input.unitCost) * Math.max(0, input.quantity))
  const { data, error } = await supabase
    .from("retail_waste")
    .insert({
      product_id:      input.productId,
      product_name:    input.productName,
      quantity:        input.quantity,
      unit_cost:       round2(input.unitCost),
      total_cost:      totalCost,
      reason:          input.reason,
      note:            input.note?.trim() || null,
      created_by:      input.createdBy,
      created_by_name: input.createdByName ?? null,
    })
    .select(COLS)
    .single()
  if (error) throw error

  void recordAudit({
    action: "retail.waste", severity: "warning",
    entityType: "retail_waste", entityId: (data as DbRetailWasteRow).id,
    meta: {
      product: input.productName, quantity: input.quantity,
      total_cost: totalCost, reason: WASTE_REASON_LABELS[input.reason],
      note: input.note?.trim() || null,
    },
  })
  return dbRowToWaste(data as DbRetailWasteRow)
}

export async function deleteWaste(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("retail_waste").delete().eq("id", id)
  if (error) throw error
  void recordAudit({ action: "retail.waste.delete", severity: "warning", entityType: "retail_waste", entityId: id })
}

export async function listTodayWaste(): Promise<RetailWaste[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("retail_waste").select(COLS)
      .gte("created_at", todayStartIso())
      .order("created_at", { ascending: false })
      .limit(200)
    if (error) throw error
    return ((data ?? []) as DbRetailWasteRow[]).map(dbRowToWaste)
  } catch { return [] }
}

export async function listWaste(fromIso: string, toIso: string, limit = 300): Promise<RetailWaste[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("retail_waste").select(COLS)
      .gte("created_at", fromIso).lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw error
    return ((data ?? []) as DbRetailWasteRow[]).map(dbRowToWaste)
  } catch { return [] }
}

/** Aggregate loss report for a date range — totals + by reason + top products. */
export async function fetchWasteReport(fromIso: string, toIso: string): Promise<WasteReport> {
  const rows = await listWaste(fromIso, toIso, 2000)
  const empty: WasteReport = { totalQty: 0, totalCost: 0, entryCount: rows.length, byReason: [], topProducts: [] }
  if (rows.length === 0) return empty

  const reasonMap = new Map<WasteReason, WasteReasonSlice>()
  const prodMap = new Map<string, WasteProductSlice>()
  for (const w of rows) {
    empty.totalQty  += w.quantity
    empty.totalCost += w.totalCost
    const r = reasonMap.get(w.reason) ?? { reason: w.reason, qty: 0, cost: 0 }
    r.qty += w.quantity; r.cost += w.totalCost; reasonMap.set(w.reason, r)
    const p = prodMap.get(w.productName) ?? { name: w.productName, qty: 0, cost: 0 }
    p.qty += w.quantity; p.cost += w.totalCost; prodMap.set(w.productName, p)
  }
  empty.totalCost = round2(empty.totalCost)
  empty.byReason = Array.from(reasonMap.values()).sort((a, b) => b.cost - a.cost)
  empty.topProducts = Array.from(prodMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 12)
  return empty
}
