// ─── Staff Shift Types ────────────────────────────────────────────────────────

export type ShiftStatus = "active" | "ended"

export interface DbShiftRow {
  id: string
  user_id: string
  branch_id: string | null
  status: ShiftStatus
  started_at: string
  ended_at: string | null
  ended_by: string | null
  ended_by_name: string | null
  started_by_name: string | null
  notes: string | null
  is_demo: boolean
  duration_seconds: number | null
}

export interface Shift {
  id: string
  userId: string
  branchId: string | null
  status: ShiftStatus
  startedAt: string
  endedAt: string | null
  endedByName: string | null
  startedByName: string | null
  notes: string | null
  durationSeconds: number | null
}

export function dbRowToShift(r: DbShiftRow): Shift {
  return {
    id: r.id,
    userId: r.user_id,
    branchId: r.branch_id,
    status: r.status,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    endedByName: r.ended_by_name,
    startedByName: r.started_by_name,
    notes: r.notes,
    durationSeconds: r.duration_seconds,
  }
}

// ─── Live roster row (view staff_shift_today) ─────────────────────────────────

export interface StaffShiftTodayRow {
  shiftId: string
  userId: string
  staffName: string | null
  staffRole: string | null
  branchId: string | null
  startedAt: string
  endedAt: string | null
  status: ShiftStatus
  durationSeconds: number | null
  lastActionAt: string | null
  actionCount: number
  refundCount: number
}

export interface DbStaffShiftTodayRow {
  shift_id: string
  user_id: string
  staff_name: string | null
  staff_role: string | null
  branch_id: string | null
  started_at: string
  ended_at: string | null
  status: ShiftStatus
  duration_seconds: number | null
  last_action_at: string | null
  action_count: number | string
  refund_count: number | string
}

export function dbRowToShiftToday(r: DbStaffShiftTodayRow): StaffShiftTodayRow {
  return {
    shiftId:        r.shift_id,
    userId:         r.user_id,
    staffName:      r.staff_name,
    staffRole:      r.staff_role,
    branchId:       r.branch_id,
    startedAt:      r.started_at,
    endedAt:        r.ended_at,
    status:         r.status,
    durationSeconds: r.duration_seconds,
    lastActionAt:   r.last_action_at,
    actionCount:    Number(r.action_count) || 0,
    refundCount:    Number(r.refund_count) || 0,
  }
}

// ─── Activity log row (from list_staff_activity RPC) ─────────────────────────

export interface StaffActivity {
  id: string
  action: string
  severity: "info" | "warning" | "error"
  userId: string | null
  staffName: string | null
  branchId: string | null
  entityType: string | null
  entityId: string | null
  meta: Record<string, unknown>
  createdAt: string
}

export interface DbStaffActivityRow {
  id: string
  action: string
  severity: "info" | "warning" | "error"
  user_id: string | null
  staff_name: string | null
  branch_id: string | null
  entity_type: string | null
  entity_id: string | null
  meta: Record<string, unknown>
  created_at: string
}

export function dbRowToActivity(r: DbStaffActivityRow): StaffActivity {
  return {
    id: r.id,
    action: r.action,
    severity: r.severity ?? "info",
    userId: r.user_id,
    staffName: r.staff_name,
    branchId: r.branch_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    meta: (r.meta ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

/** Map an action prefix to a friendly Turkish label + tone. */
export function describeAction(action: string, meta: Record<string, unknown>): {
  verb: string
  detail: string
  tone: "violet" | "blue" | "emerald" | "amber" | "rose" | "slate"
} {
  const m = meta ?? {}
  switch (true) {
    case action.startsWith("payment.create"):
      return { verb: "Ödeme aldı", detail: m.amount ? `₺${m.amount}` : "", tone: "emerald" }
    case action === "wallet.load":
      return { verb: "Cüzdan yükledi", detail: m.amount ? `+₺${m.amount}` : "", tone: "violet" }
    case action === "session.extend":
      return { verb: "Süre uzattı", detail: m.minutes ? `+${m.minutes} dk` : "", tone: "blue" }
    case action === "session.convert_unlimited":
      return { verb: "Sınırsıza geçti", detail: m.amount ? `₺${m.amount}` : "", tone: "violet" }
    case action === "refund.cancel":
      return { verb: "İade işledi", detail: m.amount ? `₺${m.amount}` : "", tone: "rose" }
    case action.startsWith("session."):
      return { verb: "Oturum işlemi", detail: action.replace("session.", ""), tone: "blue" }
    case action === "cash_register.close":
      return { verb: "Kasa kapattı", detail: "", tone: "violet" }
    case action === "entry_code.issue":
      return { verb: "Müşteri kodu üretti", detail: typeof m.code === "string" ? m.code : "", tone: "slate" }
    default:
      return { verb: action, detail: "", tone: "slate" }
  }
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0 dk"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} sa ${m} dk`
  return `${m} dk`
}

export function formatRelativeShort(iso: string | null): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 30)   return "şimdi"
  if (s < 60)   return `${s} sn`
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m} dk`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h} sa`
  const d = Math.floor(h / 24)
  return `${d} gün`
}
