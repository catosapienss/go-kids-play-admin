// ─── Customer types ──────────────────────────────────────────────────────────

/** A tag is a free-form lowercase string. The UI knows about these four. */
export type WellKnownTag = "vip" | "frequent" | "organization" | "unlimited"

export const TAG_LABEL: Record<string, string> = {
  vip:          "VIP",
  frequent:     "Sık Gelen",
  organization: "Organizasyon",
  unlimited:    "Sınırsız",
}

export const TAG_TONE: Record<string, { bg: string; fg: string; ring: string }> = {
  vip:          { bg: "bg-amber-500/15",   fg: "text-amber-700 dark:text-amber-300",   ring: "ring-amber-500/30" },
  frequent:     { bg: "bg-violet-500/15",  fg: "text-violet-700 dark:text-violet-300", ring: "ring-violet-500/30" },
  organization: { bg: "bg-pink-500/15",    fg: "text-pink-700 dark:text-pink-300",     ring: "ring-pink-500/30" },
  unlimited:    { bg: "bg-fuchsia-500/15", fg: "text-fuchsia-700 dark:text-fuchsia-300", ring: "ring-fuchsia-500/30" },
}

// ─── Customer summary (one row from customer_summary view) ───────────────────

export interface DbCustomerSummaryRow {
  id: string
  full_name: string
  phone: string
  wallet_balance: number | string
  tags: string[] | null
  is_vip: boolean
  notes: string | null
  registered_at: string
  last_visit_at: string | null
  branch_id: string | null

  visit_count: number | string
  completed_count: number | string
  last_session_at: string | null
  total_spent: number | string
  payment_count: number | string
  wallet_loaded: number | string
  refund_total: number | string
  refund_count: number | string
  child_count: number | string
}

export interface CustomerSummary {
  id: string
  fullName: string
  phone: string
  walletBalance: number
  tags: string[]
  isVip: boolean
  notes: string | null
  registeredAt: string
  lastVisitAt: string | null
  branchId: string | null

  visitCount: number
  completedCount: number
  lastSessionAt: string | null
  totalSpent: number
  paymentCount: number
  walletLoaded: number
  refundTotal: number
  refundCount: number
  childCount: number
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0
  return typeof v === "number" ? v : Number(v) || 0
}

export function dbRowToCustomerSummary(r: DbCustomerSummaryRow): CustomerSummary {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    walletBalance: num(r.wallet_balance),
    tags: Array.isArray(r.tags) ? r.tags : [],
    isVip: !!r.is_vip,
    notes: r.notes,
    registeredAt: r.registered_at,
    lastVisitAt: r.last_visit_at,
    branchId: r.branch_id,
    visitCount: num(r.visit_count),
    completedCount: num(r.completed_count),
    lastSessionAt: r.last_session_at,
    totalSpent: num(r.total_spent),
    paymentCount: num(r.payment_count),
    walletLoaded: num(r.wallet_loaded),
    refundTotal: num(r.refund_total),
    refundCount: num(r.refund_count),
    childCount: num(r.child_count),
  }
}

// ─── Child (light shape) ──────────────────────────────────────────────────────

export interface CustomerChild {
  id: string
  parent_id: string
  name: string
  age: number
  created_at?: string
}

// ─── Activity event ──────────────────────────────────────────────────────────

export type ActivityKind =
  | "session_start"
  | "payment"
  | "wallet"
  | "extension"
  | "refund"
  | "retail"

export interface CustomerActivityEvent {
  id: string
  kind: ActivityKind
  parentId: string
  branchId: string | null
  occurredAt: string
  meta: Record<string, unknown>
}

export interface DbCustomerActivityRow {
  id: string
  kind: ActivityKind
  parent_id: string
  branch_id: string | null
  occurred_at: string
  meta: Record<string, unknown>
}

export function dbRowToActivity(r: DbCustomerActivityRow): CustomerActivityEvent {
  return {
    id: r.id,
    kind: r.kind,
    parentId: r.parent_id,
    branchId: r.branch_id,
    occurredAt: r.occurred_at,
    meta: r.meta ?? {},
  }
}

// ─── Full profile bundle (from get_customer_profile RPC) ─────────────────────

export interface CustomerProfile {
  summary: CustomerSummary
  children: CustomerChild[]
  activity: CustomerActivityEvent[]
}

// ─── Repeat visitor row (from list_repeat_visitors RPC) ──────────────────────

export interface RepeatVisitor {
  parentId: string
  fullName: string
  phone: string
  visitCount: number
  totalSpent: number
  isVip: boolean
  lastSessionAt: string | null
  todayVisits: number
}

// ─── Loyalty heuristics ──────────────────────────────────────────────────────
//
// Lightweight, purely-derived. No DB point system yet — just a presentation
// tier the UI uses to highlight valuable customers.

export type LoyaltyTier = "new" | "regular" | "frequent" | "vip"

export function computeTier(c: Pick<CustomerSummary, "visitCount" | "totalSpent" | "isVip">): LoyaltyTier {
  if (c.isVip) return "vip"
  if (c.visitCount >= 20 || c.totalSpent >= 5000) return "frequent"
  if (c.visitCount >= 3) return "regular"
  return "new"
}

export const TIER_LABEL: Record<LoyaltyTier, string> = {
  new:      "Yeni",
  regular:  "Düzenli",
  frequent: "Sık Gelen",
  vip:      "VIP",
}

export const TIER_TONE: Record<LoyaltyTier, string> = {
  new:      "bg-slate-500/10  text-slate-600  dark:text-slate-300",
  regular:  "bg-blue-500/10   text-blue-700   dark:text-blue-300",
  frequent: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  vip:      "bg-amber-500/15  text-amber-700  dark:text-amber-300",
}
