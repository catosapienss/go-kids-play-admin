import { createClient } from "@/lib/supabase/client"
import {
  dbRowToCustomerSummary, type CustomerSummary, type DbCustomerSummaryRow,
} from "@/types/customer"

// ─── /crm Dashboard service ────────────────────────────────────────────────
//
// Read-only queries that drive the new CRM dashboard. Everything here hits
// the existing `customer_summary` view + `children` master table. No writes,
// no RPC calls that mutate state — pure reads against production data.

export interface CrmTableRow extends CustomerSummary {
  /** Short, human-readable identifier shown in the table. First 8 chars of UUID. */
  shortId:    string
  /** First / primary child name when one exists. Used when the table needs a
   *  "Child Name" column even though customer_summary is parent-scoped. */
  firstChild: string | null
  /** Other child names (for disambiguation tooltips on common names). */
  otherChildren: string[]
}

export interface CrmStats {
  total:        number
  newThisMonth: number
  returning:    number
  today:        number
}

function shortIdFromUuid(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase()
}

/** Top-of-month TR-local timestamp as ISO (used by the "new this month" stat). */
function trMonthStartIso(now = new Date()): string {
  // Compute Y-M-01 00:00 in TR-local, then convert back to UTC ISO for the query.
  // The DB rows store created_at in UTC; cmp is straight ISO compare.
  const tr = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }))
  const monthStart = new Date(Date.UTC(tr.getFullYear(), tr.getMonth(), 1, -3, 0, 0))
  return monthStart.toISOString()
}

/** TR-local midnight today as UTC ISO. */
function trTodayStartIso(now = new Date()): string {
  const tr = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }))
  const dayStart = new Date(Date.UTC(tr.getFullYear(), tr.getMonth(), tr.getDate(), -3, 0, 0))
  return dayStart.toISOString()
}

/**
 * Listing query for the CRM table. When `search` is non-empty, calls
 * `search_customers` RPC (already handles name/phone/child-name LIKE).
 * Otherwise pulls the most recently-active `limit` customers directly from
 * `customer_summary`.
 *
 * Always enriches with first child name via a single batched `children`
 * select so the table row can display "child name" without a per-row fetch.
 */
export async function listCustomers(
  { search, limit = 200 }: { search?: string; limit?: number } = {},
): Promise<CrmTableRow[]> {
  const supabase = createClient()
  const q = (search ?? "").trim()

  let summaries: CustomerSummary[]
  if (q.length >= 2) {
    // Search RPC (name / phone / child name) AND parallel ID-prefix match so
    // typing the visible short id (first 8 hex chars) also resolves the row.
    const idLike = q.replace(/[^0-9a-fA-F]/g, "").toLowerCase()
    const [rpcRes, idRes] = await Promise.all([
      supabase.rpc("search_customers", { p_query: q, p_limit: limit }),
      idLike.length >= 4
        ? supabase.from("customer_summary").select("*")
            .ilike("id", `${idLike}%`)
            .limit(20)
        : Promise.resolve({ data: [], error: null } as { data: DbCustomerSummaryRow[]; error: null }),
    ])
    if (rpcRes.error) throw rpcRes.error
    const merged = new Map<string, DbCustomerSummaryRow>()
    for (const r of ((rpcRes.data ?? []) as DbCustomerSummaryRow[])) merged.set(r.id, r)
    for (const r of ((idRes.data ?? []) as DbCustomerSummaryRow[])) merged.set(r.id, r)
    summaries = Array.from(merged.values()).map(dbRowToCustomerSummary)
  } else {
    const { data, error } = await supabase
      .from("customer_summary")
      .select("*")
      .order("last_visit_at", { ascending: false, nullsFirst: false })
      .limit(limit)
    if (error) throw error
    summaries = ((data ?? []) as DbCustomerSummaryRow[]).map(dbRowToCustomerSummary)
  }

  if (summaries.length === 0) return []

  // Single batched fetch for children of all returned parents.
  const parentIds = summaries.map((s) => s.id)
  // Production `children` table stores the kid's name in `full_name`.
  const { data: kids } = await supabase
    .from("children")
    .select("parent_id, full_name")
    .in("parent_id", parentIds)
    .order("created_at", { ascending: true })

  const byParent = new Map<string, string[]>()
  for (const k of (kids ?? []) as { parent_id: string; full_name: string | null }[]) {
    const label = (k.full_name ?? "").trim()
    if (!label) continue
    const arr = byParent.get(k.parent_id) ?? []
    arr.push(label)
    byParent.set(k.parent_id, arr)
  }

  return summaries.map((s): CrmTableRow => {
    const names = byParent.get(s.id) ?? []
    return {
      ...s,
      shortId:       shortIdFromUuid(s.id),
      firstChild:    names[0] ?? null,
      otherChildren: names.slice(1),
    }
  })
}

/**
 * Header-stat counts for the CRM dashboard.
 *
 *   • total         — all rows in `parents`
 *   • newThisMonth  — registered_at ≥ TR-month start
 *   • returning     — visit_count ≥ 2
 *   • today         — last_session_at ≥ TR-day start
 *
 * Each runs as a head-only count query so we never pull row payloads.
 */
export async function getCrmStats(): Promise<CrmStats> {
  const supabase = createClient()
  const monthStart = trMonthStartIso()
  const dayStart   = trTodayStartIso()

  const [totalRes, newRes, returningRes, todayRes] = await Promise.all([
    supabase.from("parents").select("id", { count: "exact", head: true }),
    supabase.from("parents").select("id", { count: "exact", head: true })
      .gte("created_at", monthStart),
    supabase.from("customer_summary").select("id", { count: "exact", head: true })
      .gte("visit_count", 2),
    supabase.from("customer_summary").select("id", { count: "exact", head: true })
      .gte("last_session_at", dayStart),
  ])

  return {
    total:        totalRes.count        ?? 0,
    newThisMonth: newRes.count          ?? 0,
    returning:    returningRes.count    ?? 0,
    today:        todayRes.count        ?? 0,
  }
}
