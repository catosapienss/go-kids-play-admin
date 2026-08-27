import { createClient } from "@/lib/supabase/client"
import { toAppError, AppError } from "@/lib/reliability/errors"
import { safeFinanceAction } from "@/lib/reliability/idempotency"
import { recordAudit } from "@/lib/reliability/audit-log"
import { createLogger } from "@/lib/reliability/logger"
import {
  dbRowToMembership, dbRowToPause, dbRowToPackage, jsonToRuleStatus,
  type DbMembershipRow, type DbPauseRow,
  type Membership, type MembershipPause, type MembershipType,
  type MembershipPackage, type MembershipRuleStatus,
} from "@/types/membership"

const log = createLogger("membership")

// ─── Mapper helper for RPC errors ────────────────────────────────────────────

function mapMembershipError(message: string): AppError | null {
  const tr: Record<string, string> = {
    invalid_type:               "Geçersiz üyelik türü.",
    punch_pass_requires_uses:   "Kontörlü üyelik için kullanım hakkı sayısı zorunlu.",
    invalid_duration:           "Süre geçerli değil.",
    membership_not_found:       "Üyelik bulunamadı.",
    pause_only_unlimited:       "Sadece sınırsız üyelikler duraklatılabilir.",
    membership_not_active:      "Üyelik aktif değil.",
    membership_not_paused:      "Üyelik duraklatılmamış.",
    pause_state_corrupted:      "Duraklatma durumu hatalı.",
    not_punch_pass:             "Bu üyelik türünde kullanım hakkı tüketilemez.",
    no_uses_left:               "Kalan kullanım hakkı yok.",
  }
  for (const key of Object.keys(tr)) {
    if (message.includes(key)) {
      return new AppError({
        code: "validation",
        message: key,
        userMessage: tr[key],
        retryable: false,
      })
    }
  }
  return null
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listAllMemberships(opts: { limit?: number; status?: string } = {}): Promise<Membership[]> {
  const supabase = createClient()
  let q = supabase.from("memberships").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 100)
  if (opts.status) q = q.eq("status", opts.status)
  const { data, error } = await q
  if (error) throw toAppError(error)
  return ((data ?? []) as DbMembershipRow[]).map(dbRowToMembership)
}

export async function listParentMemberships(parentId: string): Promise<Membership[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select("*")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false })
  if (error) throw toAppError(error)
  return ((data ?? []) as DbMembershipRow[]).map(dbRowToMembership)
}

export async function listMembershipPauses(membershipId: string): Promise<MembershipPause[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("membership_pauses")
    .select("*")
    .eq("membership_id", membershipId)
    .order("paused_at", { ascending: false })
  if (error) throw toAppError(error)
  return ((data ?? []) as DbPauseRow[]).map(dbRowToPause)
}

// ─── Analytics (single-shot from view) ───────────────────────────────────────

export interface MembershipAnalytics {
  total: number
  activeCount: number
  pausedCount: number
  expiredCount: number
  unlimitedActive: number
  monthlyActive: number
  punchActive: number
  expiringSoon: number
}

interface RawAnalyticsRow {
  total: number | string
  active_count: number | string
  paused_count: number | string
  expired_count: number | string
  unlimited_active: number | string
  monthly_active: number | string
  punch_active: number | string
  expiring_soon: number | string
}

export async function getMembershipAnalytics(): Promise<MembershipAnalytics> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("membership_analytics")
    .select("*")
  if (error) throw toAppError(error)
  const rows = (data ?? []) as RawAnalyticsRow[]
  // View is grouped by branch; for current branch the caller will see exactly
  // one row (or none for super-admin in "All branches" mode → sum here).
  const sum: MembershipAnalytics = {
    total: 0, activeCount: 0, pausedCount: 0, expiredCount: 0,
    unlimitedActive: 0, monthlyActive: 0, punchActive: 0, expiringSoon: 0,
  }
  for (const r of rows) {
    sum.total             += Number(r.total)            || 0
    sum.activeCount       += Number(r.active_count)     || 0
    sum.pausedCount       += Number(r.paused_count)     || 0
    sum.expiredCount      += Number(r.expired_count)    || 0
    sum.unlimitedActive   += Number(r.unlimited_active) || 0
    sum.monthlyActive     += Number(r.monthly_active)   || 0
    sum.punchActive       += Number(r.punch_active)     || 0
    sum.expiringSoon      += Number(r.expiring_soon)    || 0
  }
  return sum
}

// ─── Membership packages + monthly-membership sale (migration 035) ──────────

export async function listPackages(opts?: { onlyActive?: boolean }): Promise<MembershipPackage[]> {
  try {
    const supabase = createClient()
    let q = supabase.from("membership_packages").select("*").order("sort_order", { ascending: true })
    if (opts?.onlyActive) q = q.eq("active", true)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []).map((r) => dbRowToPackage(r as Record<string, unknown>))
  } catch { return [] }
}

/** Today's entitlement for a child (weekday-unlimited / weekend remaining). */
export async function getMembershipStatusForChild(childId: string): Promise<MembershipRuleStatus> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("membership_status_for_child", { p_child_id: childId })
    if (error) throw error
    return jsonToRuleStatus(data as Record<string, unknown> | null)
  } catch { return { hasMembership: false } }
}

/** Add weekend minutes for a child; throws "weekend_limit_exceeded" past the cap. */
export async function recordWeekendUsage(membershipId: string, childId: string, minutes: number): Promise<number> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("record_membership_weekend_usage", {
    p_membership_id: membershipId, p_child_id: childId, p_minutes: minutes,
  })
  if (error) {
    if (error.message?.includes("weekend_limit_exceeded")) throw new Error("Hafta sonu günlük limiti (180 dk) aşılamaz")
    throw error
  }
  return Number(data ?? 0)
}

export interface SellMembershipInput {
  packageId: string
  parentId: string
  childIds: string[]
  cash?: number
  card?: number
  wallet?: number
  notes?: string
}

/** Sell a monthly membership (single or sibling). Manager+ enforced server-side. */
export async function sellMembership(input: SellMembershipInput): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("sell_membership", {
    p_package_id: input.packageId,
    p_parent_id:  input.parentId,
    p_child_ids:  input.childIds,
    p_cash:   input.cash ?? 0,
    p_card:   input.card ?? 0,
    p_wallet: input.wallet ?? 0,
    p_notes:  input.notes ?? null,
  })
  if (error) {
    const map: Record<string, string> = {
      not_authorized:       "Bu işlem için yönetici yetkisi gerekli",
      package_not_found:    "Paket bulunamadı",
      child_count_mismatch: "Bu paket için seçilen çocuk sayısı hatalı",
      child_not_owned:      "Seçilen çocuklar bu veliye ait değil",
    }
    const key = Object.keys(map).find((k) => error.message?.includes(k))
    throw new Error(key ? map[key] : (error.message ?? "Üyelik satılamadı"))
  }
  void recordAudit({ action: "membership.sell", severity: "info", entityType: "membership", entityId: data as string,
    meta: { packageId: input.packageId, childCount: input.childIds.length } })
  return data as string
}

/** Owner-only: create/update a membership package definition. */
export async function upsertMembershipPackage(pkg: Omit<Partial<MembershipPackage>, "id"> & { id?: string | null }): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("upsert_membership_package", {
    p_id: pkg.id ?? null,
    p_name: pkg.name, p_price: pkg.price, p_included_children: pkg.includedChildren,
    p_validity_days: pkg.validityDays, p_weekday_unlimited: pkg.weekdayUnlimited,
    p_weekend_daily_minutes: pkg.weekendDailyMinutes, p_brewmood_discount_pct: pkg.brewmoodDiscountPct,
    p_active: pkg.active ?? true,
  })
  if (error) {
    if (error.message?.includes("not_authorized")) throw new Error("Sadece yönetici düzenleyebilir")
    throw error
  }
  return data as string
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface CreateMembershipInput {
  parentId: string
  childId?: string | null
  type: MembershipType
  durationDays?: number
  totalUses?: number
  provider?: string
  externalId?: string
  notes?: string
}

export async function createMembership(input: CreateMembershipInput): Promise<Membership> {
  return safeFinanceAction(
    `membership.create:${input.parentId}:${input.type}`,
    "membership.create",
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("create_membership", {
        p_parent_id:     input.parentId,
        p_child_id:      input.childId ?? null,
        p_type:          input.type,
        p_duration_days: input.durationDays ?? 30,
        p_total_uses:    input.totalUses ?? null,
        p_provider:      input.provider ?? "manual",
        p_external_id:   input.externalId ?? null,
        p_notes:         input.notes ?? null,
      })
      if (error) {
        const mapped = mapMembershipError(error.message ?? "")
        if (mapped) throw mapped
        throw toAppError(error)
      }
      const row = (Array.isArray(data) ? data[0] : data) as DbMembershipRow
      const m = dbRowToMembership(row)
      log.info("membership created", { id: m.id, type: m.type })
      void recordAudit({
        action: "membership.create",
        entityType: "membership",
        entityId: m.id,
        meta: { type: input.type, durationDays: input.durationDays, totalUses: input.totalUses },
      })
      return m
    },
  )
}

export async function pauseMembership(id: string, reason?: string): Promise<Membership> {
  return safeFinanceAction(
    `membership.pause:${id}`,
    "membership.pause",
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("pause_membership", {
        p_membership_id: id,
        p_reason:        reason ?? null,
      })
      if (error) {
        const mapped = mapMembershipError(error.message ?? "")
        if (mapped) throw mapped
        throw toAppError(error)
      }
      const row = (Array.isArray(data) ? data[0] : data) as DbMembershipRow
      const m = dbRowToMembership(row)
      void recordAudit({
        action: "membership.pause",
        severity: "warning",
        entityType: "membership",
        entityId: m.id,
        meta: { reason: reason ?? null },
      })
      return m
    },
  )
}

export async function resumeMembership(id: string): Promise<Membership> {
  return safeFinanceAction(
    `membership.resume:${id}`,
    "membership.resume",
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("resume_membership", {
        p_membership_id: id,
      })
      if (error) {
        const mapped = mapMembershipError(error.message ?? "")
        if (mapped) throw mapped
        throw toAppError(error)
      }
      const row = (Array.isArray(data) ? data[0] : data) as DbMembershipRow
      const m = dbRowToMembership(row)
      void recordAudit({
        action: "membership.resume",
        entityType: "membership",
        entityId: m.id,
      })
      return m
    },
  )
}

export async function consumeMembershipUse(id: string): Promise<Membership> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("consume_membership_use", {
    p_membership_id: id,
  })
  if (error) {
    const mapped = mapMembershipError(error.message ?? "")
    if (mapped) throw mapped
    throw toAppError(error)
  }
  const row = (Array.isArray(data) ? data[0] : data) as DbMembershipRow
  const m = dbRowToMembership(row)
  void recordAudit({
    action: "membership.consume_use",
    entityType: "membership",
    entityId: m.id,
    meta: { remainingUses: m.remainingUses ?? 0 },
  })
  return m
}

// ─── Personal access entitlements (migration 039) ────────────────────────────
//
// Customer-specific punch passes (e.g. "Elis — 20 entry days, ₺5.000") bound to
// one parent+child, never shown in the public package catalog. They reuse the
// punch_pass model + consume_membership_use, so consuming a personal-access day
// is just `consumeMembershipUse(entitlement.id)`.

export interface CreatePersonalEntitlementInput {
  parentId: string
  childId: string
  label: string
  price: number
  uses: number
  paymentMethod?: "cash" | "card" | "transfer"
  paymentStatus?: "paid" | "unpaid" | "partial"
  notes?: string | null
}

export async function createPersonalEntitlement(input: CreatePersonalEntitlementInput): Promise<Membership> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_personal_entitlement", {
    p_parent_id:      input.parentId,
    p_child_id:       input.childId,
    p_label:          input.label,
    p_price:          input.price,
    p_uses:           input.uses,
    p_payment_method: input.paymentMethod ?? "cash",
    p_payment_status: input.paymentStatus ?? "paid",
    p_notes:          input.notes ?? null,
  })
  if (error) throw toAppError(error)
  const row = (Array.isArray(data) ? data[0] : data) as DbMembershipRow
  const m = dbRowToMembership(row)
  void recordAudit({
    action: "membership.personal_entitlement.create",
    entityType: "membership",
    entityId: m.id,
    meta: { label: input.label, uses: input.uses, price: input.price },
  })
  return m
}

export interface PersonalEntitlementRow extends Membership {
  parentName: string
  childName: string
}

/** All personal entitlements (any status) with parent + child names, newest
 *  first — for the admin management panel. */
export async function listAllPersonalEntitlements(): Promise<PersonalEntitlementRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select("*, parents(full_name), children(full_name)")
    .eq("is_personal", true)
    .order("created_at", { ascending: false })
  if (error) throw toAppError(error)
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const m = dbRowToMembership(r as unknown as DbMembershipRow)
    const parent = r.parents as { full_name?: string } | null
    const child = r.children as { full_name?: string } | null
    return { ...m, parentName: parent?.full_name ?? "—", childName: child?.full_name ?? "—" }
  })
}

/** Active personal-access entitlements for a child, most recent first — feeds
 *  the staff "Use Personal Access" picker (20-Day / 14-Day, each with remaining
 *  count). Excludes exhausted/cancelled ones. */
export async function listActivePersonalEntitlements(childId: string): Promise<Membership[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select("*")
    .eq("child_id", childId)
    .eq("is_personal", true)
    .eq("type", "punch_pass")
    .eq("status", "active")
    .gt("remaining_uses", 0)
    .order("created_at", { ascending: false })
  if (error) throw toAppError(error)
  return ((data ?? []) as DbMembershipRow[]).map(dbRowToMembership)
}

export async function cancelMembership(id: string, reason = "manual"): Promise<Membership> {
  return safeFinanceAction(
    `membership.cancel:${id}`,
    "membership.cancel",
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("cancel_membership", {
        p_membership_id: id,
        p_reason:        reason,
      })
      if (error) {
        const mapped = mapMembershipError(error.message ?? "")
        if (mapped) throw mapped
        throw toAppError(error)
      }
      const row = (Array.isArray(data) ? data[0] : data) as DbMembershipRow
      const m = dbRowToMembership(row)
      void recordAudit({
        action: "membership.cancel",
        severity: "warning",
        entityType: "membership",
        entityId: m.id,
        meta: { reason },
      })
      return m
    },
  )
}
