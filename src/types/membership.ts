// ─── Membership types ────────────────────────────────────────────────────────

export type MembershipType   = "unlimited" | "monthly" | "punch_pass" | "timed"
export type MembershipStatus = "active" | "paused" | "expired" | "cancelled"

// ─── UI metadata ──────────────────────────────────────────────────────────────

export const TYPE_LABEL: Record<MembershipType, string> = {
  unlimited:  "Sınırsız",
  monthly:    "Aylık",
  punch_pass: "Kontörlü",
  timed:      "Süreli",
}

export const TYPE_TONE: Record<MembershipType, { bg: string; fg: string; gradient: string }> = {
  unlimited:  { bg: "bg-fuchsia-500/10", fg: "text-fuchsia-700 dark:text-fuchsia-300", gradient: "from-fuchsia-500 to-pink-600" },
  monthly:    { bg: "bg-violet-500/10",  fg: "text-violet-700 dark:text-violet-300",   gradient: "from-violet-500 to-purple-600" },
  punch_pass: { bg: "bg-blue-500/10",    fg: "text-blue-700 dark:text-blue-300",       gradient: "from-blue-500 to-indigo-600" },
  timed:      { bg: "bg-emerald-500/10", fg: "text-emerald-700 dark:text-emerald-300", gradient: "from-emerald-500 to-teal-600" },
}

export const STATUS_LABEL: Record<MembershipStatus, string> = {
  active:    "Aktif",
  paused:    "Duraklatıldı",
  expired:   "Süresi Doldu",
  cancelled: "İptal",
}

export const STATUS_TONE: Record<MembershipStatus, string> = {
  active:    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paused:    "bg-amber-500/15   text-amber-700   dark:text-amber-300",
  expired:   "bg-slate-500/15   text-slate-600   dark:text-slate-300",
  cancelled: "bg-rose-500/15    text-rose-700    dark:text-rose-300",
}

// ─── DB row ──────────────────────────────────────────────────────────────────

export interface DbMembershipRow {
  id: string
  parent_id: string
  child_id: string | null
  type: MembershipType
  status: MembershipStatus
  started_at: string
  ends_at: string | null
  paused_at: string | null
  paused_seconds: number | string
  total_uses: number | null
  remaining_uses: number | null
  notes: string | null
  provider: string
  external_id: string | null
  branch_id: string | null
  created_at: string
  updated_at: string
}

export interface Membership {
  id: string
  parentId: string
  childId: string | null
  type: MembershipType
  status: MembershipStatus
  startedAt: string
  endsAt: string | null
  pausedAt: string | null
  pausedSeconds: number
  totalUses: number | null
  remainingUses: number | null
  notes: string | null
  provider: string
  externalId: string | null
  branchId: string | null
  createdAt: string
  updatedAt: string
}

export function dbRowToMembership(r: DbMembershipRow): Membership {
  return {
    id: r.id,
    parentId: r.parent_id,
    childId: r.child_id,
    type: r.type,
    status: r.status,
    startedAt: r.started_at,
    endsAt: r.ends_at,
    pausedAt: r.paused_at,
    pausedSeconds: Number(r.paused_seconds) || 0,
    totalUses: r.total_uses,
    remainingUses: r.remaining_uses,
    notes: r.notes,
    provider: r.provider,
    externalId: r.external_id,
    branchId: r.branch_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// ─── Pause row ───────────────────────────────────────────────────────────────

export interface DbPauseRow {
  id: string
  membership_id: string
  paused_at: string
  resumed_at: string | null
  duration_seconds: number | string | null
  reason: string | null
  paused_by_name: string | null
}

export interface MembershipPause {
  id: string
  membershipId: string
  pausedAt: string
  resumedAt: string | null
  durationSeconds: number | null
  reason: string | null
  pausedByName: string | null
}

export function dbRowToPause(r: DbPauseRow): MembershipPause {
  return {
    id: r.id,
    membershipId: r.membership_id,
    pausedAt: r.paused_at,
    resumedAt: r.resumed_at,
    durationSeconds: r.duration_seconds == null ? null : Number(r.duration_seconds),
    reason: r.reason,
    pausedByName: r.paused_by_name,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Days remaining on a time-bound membership (positive int) or null. */
export function daysRemaining(m: Membership): number | null {
  if (!m.endsAt) return null
  const diff = new Date(m.endsAt).getTime() - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / 86_400_000)
}

export function isExpiringSoon(m: Membership): boolean {
  const d = daysRemaining(m)
  return d !== null && d > 0 && d <= 7
}

export function canPause(m: Membership): boolean {
  return m.type === "unlimited" && m.status === "active"
}

export function canResume(m: Membership): boolean {
  return m.type === "unlimited" && m.status === "paused"
}
