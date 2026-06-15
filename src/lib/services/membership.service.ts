import { createClient } from "@/lib/supabase/client"
import { toAppError, AppError } from "@/lib/reliability/errors"
import { safeFinanceAction } from "@/lib/reliability/idempotency"
import { recordAudit } from "@/lib/reliability/audit-log"
import { createLogger } from "@/lib/reliability/logger"
import {
  dbRowToMembership, dbRowToPause,
  type DbMembershipRow, type DbPauseRow,
  type Membership, type MembershipPause, type MembershipType,
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
