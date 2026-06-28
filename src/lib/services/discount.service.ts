import { createClient } from "@/lib/supabase/client"
import { createLogger } from "@/lib/reliability/logger"
import { recordAudit } from "@/lib/reliability/audit-log"

const log = createLogger("discounts")

// ─── Discount service ────────────────────────────────────────────────────────
//
// Writes are fire-and-forget — discounts are an AUDIT artefact; the operator's
// payment must still go through even if the audit row fails to land. Reads
// gracefully tolerate the table not existing yet (returns empty/zero) so the
// UI keeps rendering before the operator runs the migration SQL.

export type DiscountType = "percent" | "fixed"

export type DiscountReason =
  | "customer_loyalty"
  | "sibling_discount"
  | "birthday_discount"
  | "manager_approval"
  | "special_campaign"
  | "other"

export const DISCOUNT_REASON_LABELS: Record<DiscountReason, string> = {
  customer_loyalty:  "Müşteri Sadakati",
  sibling_discount:  "Kardeş İndirimi",
  birthday_discount: "Doğum Günü İndirimi",
  manager_approval:  "Yönetici Onayı",
  special_campaign:  "Özel Kampanya",
  other:             "Diğer",
}

// ─── Compute the ₺ value of a (type, value, base) tuple ─────────────────────

export function computeDiscountAmount(
  type: DiscountType,
  value: number,
  base:  number,
): number {
  if (!value || value <= 0 || base <= 0) return 0
  if (type === "percent") {
    const clamped = Math.min(100, Math.max(0, value))
    return Math.round((base * clamped) / 100)
  }
  return Math.min(base, Math.round(value))
}

// ─── Role-based cap ──────────────────────────────────────────────────────────

export function maxDiscountForRole(
  role: string | undefined,
  limits: { staffMaxDiscount: number; managerMaxDiscount: number },
): number {
  if (role === "super_admin" || role === "admin" || role === "owner") return Infinity
  if (role === "manager") return limits.managerMaxDiscount
  return limits.staffMaxDiscount
}

// ─── Write ───────────────────────────────────────────────────────────────────

export interface RecordDiscountInput {
  sessionId?:      string | null
  paymentId?:      string | null
  parentId?:       string | null
  type:            DiscountType
  value:           number     // raw user input (10 for "10%", 50 for "₺50")
  amount:          number     // resolved ₺
  baseAmount?:     number     // gross total before the discount
  reason?:         DiscountReason | null
  appliedBy?:      string | null
  appliedByName?:  string | null
}

export async function recordDiscount(input: RecordDiscountInput): Promise<void> {
  if (input.amount <= 0) return
  try {
    const supabase = createClient()
    const { error } = await supabase.from("discounts").insert({
      session_id:      input.sessionId  ?? null,
      payment_id:      input.paymentId  ?? null,
      parent_id:       input.parentId   ?? null,
      discount_type:   input.type,
      discount_value:  input.value,
      discount_amount: input.amount,
      base_amount:     input.baseAmount ?? null,
      reason:          input.reason     ?? null,
      applied_by:      input.appliedBy  ?? null,
      applied_by_name: input.appliedByName ?? null,
    })
    if (error) throw error
    void recordAudit({
      action: "discount.apply",
      entityType: "discount",
      entityId:   input.sessionId ?? input.paymentId ?? undefined,
      meta: {
        type:   input.type,
        value:  input.value,
        amount: input.amount,
        reason: input.reason ?? null,
      },
    })
  } catch (e) {
    // Don't break the parent transaction — log + audit only.
    log.warn("discount insert failed", { amount: input.amount }, e)
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface DiscountRow {
  id:              string
  session_id:      string | null
  parent_id:       string | null
  discount_type:   DiscountType
  discount_value:  number
  discount_amount: number
  reason:          string | null
  applied_by:      string | null
  applied_by_name: string | null
  created_at:      string
}

export async function listRecentDiscounts(
  opts: { fromIso?: string; toIso?: string; limit?: number } = {},
): Promise<DiscountRow[]> {
  try {
    const supabase = createClient()
    let q = supabase
      .from("discounts")
      .select("id, session_id, parent_id, discount_type, discount_value, discount_amount, reason, applied_by, applied_by_name, created_at")
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 100)
    if (opts.fromIso) q = q.gte("created_at", opts.fromIso)
    if (opts.toIso)   q = q.lte("created_at", opts.toIso)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as DiscountRow[]
  } catch (e) {
    log.warn("listRecentDiscounts failed (table missing?)", undefined, e)
    return []
  }
}

export async function sumDiscountsBetween(fromIso: string, toIso: string): Promise<number> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("discounts")
      .select("discount_amount")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
    if (error) throw error
    return (data ?? []).reduce((s, r) => s + Number((r as { discount_amount: number }).discount_amount || 0), 0)
  } catch (e) {
    log.warn("sumDiscountsBetween failed", undefined, e)
    return 0
  }
}

export async function sumDiscountsForParent(parentId: string): Promise<number> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("discounts")
      .select("discount_amount")
      .eq("parent_id", parentId)
    if (error) throw error
    return (data ?? []).reduce((s, r) => s + Number((r as { discount_amount: number }).discount_amount || 0), 0)
  } catch (e) {
    log.warn("sumDiscountsForParent failed", undefined, e)
    return 0
  }
}
