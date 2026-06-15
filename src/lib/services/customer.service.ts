import { createClient } from "@/lib/supabase/client"
import { toAppError, AppError } from "@/lib/reliability/errors"
import { createLogger } from "@/lib/reliability/logger"
import { recordAudit } from "@/lib/reliability/audit-log"
import {
  dbRowToCustomerSummary, dbRowToActivity,
  type CustomerSummary, type DbCustomerSummaryRow,
  type CustomerActivityEvent, type DbCustomerActivityRow,
  type CustomerProfile, type CustomerChild,
  type RepeatVisitor,
} from "@/types/customer"

const log = createLogger("customer")

// ─── Search ──────────────────────────────────────────────────────────────────

export async function searchCustomers(
  query: string,
  limit = 12,
): Promise<CustomerSummary[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("search_customers", {
    p_query: query,
    p_limit: limit,
  })
  if (error) throw toAppError(error)
  return ((data ?? []) as DbCustomerSummaryRow[]).map(dbRowToCustomerSummary)
}

/** Recent customers (no query). Used as the default search-palette state. */
export async function getRecentCustomers(limit = 8): Promise<CustomerSummary[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("customer_summary")
    .select("*")
    .order("last_visit_at", { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw toAppError(error)
  return ((data ?? []) as DbCustomerSummaryRow[]).map(dbRowToCustomerSummary)
}

// ─── Single profile (one round-trip via RPC) ─────────────────────────────────

interface RawProfile {
  ok: boolean
  reason?: "not_found"
  summary?: DbCustomerSummaryRow
  children?: CustomerChild[]
  activity?: DbCustomerActivityRow[]
}

export async function getCustomerProfile(parentId: string): Promise<CustomerProfile | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_customer_profile", {
    p_parent_id: parentId,
  })
  if (error) throw toAppError(error)
  const r = data as RawProfile
  if (!r?.ok || !r.summary) return null

  return {
    summary:  dbRowToCustomerSummary(r.summary),
    children: r.children ?? [],
    activity: (r.activity ?? []).map(dbRowToActivity),
  }
}

// ─── Activity feed (filterable) ──────────────────────────────────────────────

export async function getCustomerActivity(
  parentId: string,
  opts: { kinds?: CustomerActivityEvent["kind"][]; limit?: number } = {},
): Promise<CustomerActivityEvent[]> {
  const supabase = createClient()
  let q = supabase
    .from("customer_activity")
    .select("*")
    .eq("parent_id", parentId)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(100, opts.limit ?? 50))

  if (opts.kinds?.length) {
    q = q.in("kind", opts.kinds as readonly string[])
  }

  const { data, error } = await q
  if (error) throw toAppError(error)
  return ((data ?? []) as DbCustomerActivityRow[]).map(dbRowToActivity)
}

// ─── Repeat visitors (dashboard insight) ─────────────────────────────────────

interface DbRepeatVisitor {
  parent_id: string
  full_name: string
  phone: string
  visit_count: number | string
  total_spent: number | string
  is_vip: boolean
  last_session_at: string | null
  today_visits: number | string
}

export async function listRepeatVisitors(limit = 8): Promise<RepeatVisitor[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("list_repeat_visitors", { p_limit: limit })
  if (error) throw toAppError(error)
  return ((data ?? []) as DbRepeatVisitor[]).map((r) => ({
    parentId:      r.parent_id,
    fullName:      r.full_name,
    phone:         r.phone,
    visitCount:    Number(r.visit_count) || 0,
    totalSpent:    Number(r.total_spent) || 0,
    isVip:         !!r.is_vip,
    lastSessionAt: r.last_session_at,
    todayVisits:   Number(r.today_visits) || 0,
  }))
}

// ─── Tag management (manager+ only) ──────────────────────────────────────────

export async function setCustomerTag(
  parentId: string,
  tag: string,
  active: boolean,
): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("set_customer_tag", {
    p_parent_id: parentId,
    p_tag:       tag,
    p_active:    active,
  })
  if (error) {
    if ((error.message ?? "").includes("forbidden")) {
      throw new AppError({
        code: "forbidden",
        message: "forbidden",
        userMessage: "Etiket düzenleme için yönetici yetkisi gerekli.",
        retryable: false,
      })
    }
    throw toAppError(error)
  }
  log.info("customer tag updated", { parentId, tag, active })
  void recordAudit({
    action: active ? "customer.tag.add" : "customer.tag.remove",
    entityType: "parent",
    entityId: parentId,
    meta: { tag },
  })
  return (data as string[]) ?? []
}
