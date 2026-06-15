import { createClient } from "@/lib/supabase/client"
import { recordAudit } from "@/lib/reliability/audit-log"
import { createLogger } from "@/lib/reliability/logger"
import { toAppError, AppError } from "@/lib/reliability/errors"
import {
  dbRowToShift, dbRowToShiftToday, dbRowToActivity,
  type Shift, type DbShiftRow,
  type StaffShiftTodayRow, type DbStaffShiftTodayRow,
  type StaffActivity, type DbStaffActivityRow,
} from "@/types/staff-shift"

const log = createLogger("staff-shift")

// ─── Shift Lifecycle ─────────────────────────────────────────────────────────

/** Start (or fetch the existing) active shift for the caller. */
export async function startShift(notes?: string): Promise<Shift> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("start_shift", {
    p_notes: notes ?? null,
  })
  if (error) throw toAppError(error)
  const shift = dbRowToShift(data as DbShiftRow)
  log.info("shift started", { shiftId: shift.id })
  void recordAudit({
    action: "shift.start",
    entityType: "staff_shift",
    entityId: shift.id,
  })
  return shift
}

/** End the caller's own active shift (or another user's if manager+). */
export async function endShift(targetUserId?: string, notes?: string): Promise<Shift> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("end_shift", {
    p_user_id: targetUserId ?? null,
    p_notes:   notes ?? null,
  })
  if (error) {
    const msg = error.message ?? ""
    if (msg.includes("no_active_shift")) {
      throw new AppError({
        code: "not-found",
        message: "no_active_shift",
        userMessage: "Aktif vardiya bulunamadı.",
        retryable: false,
      })
    }
    if (msg.includes("forbidden")) {
      throw new AppError({
        code: "forbidden",
        message: "forbidden",
        userMessage: "Başka birinin vardiyasını sadece yönetici bitirebilir.",
        retryable: false,
      })
    }
    throw toAppError(error)
  }
  const shift = dbRowToShift(data as DbShiftRow)
  log.info("shift ended", { shiftId: shift.id, durationSec: shift.durationSeconds })
  void recordAudit({
    action: "shift.end",
    entityType: "staff_shift",
    entityId: shift.id,
    meta: { durationSeconds: shift.durationSeconds ?? 0, targetUserId: targetUserId ?? null },
  })
  return shift
}

/** Returns the caller's currently-active shift, or null if not on the clock. */
export async function getActiveShift(): Promise<Shift | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_active_shift")
  if (error) throw toAppError(error)
  if (!data || (Array.isArray(data) && data.length === 0)) return null
  const row = (Array.isArray(data) ? data[0] : data) as DbShiftRow
  // RPC returns the empty row literal `()` when no shift; guard against that.
  return row?.id ? dbRowToShift(row) : null
}

// ─── Live roster (today's shifts + their action counts) ──────────────────────

export async function listTodayStaff(): Promise<StaffShiftTodayRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("staff_shift_today")
    .select("*")
    .order("started_at", { ascending: true })
  if (error) throw toAppError(error)
  return ((data ?? []) as DbStaffShiftTodayRow[]).map(dbRowToShiftToday)
}

// ─── Shift history ───────────────────────────────────────────────────────────

export async function listShifts(
  filters: { userId?: string; sinceDays?: number; limit?: number } = {},
): Promise<Shift[]> {
  const supabase = createClient()
  let q = supabase.from("staff_shifts").select("*").order("started_at", { ascending: false })

  if (filters.userId) q = q.eq("user_id", filters.userId)
  if (filters.sinceDays && filters.sinceDays > 0) {
    const since = new Date(Date.now() - filters.sinceDays * 86_400_000).toISOString()
    q = q.gte("started_at", since)
  }
  q = q.limit(Math.min(200, filters.limit ?? 50))

  const { data, error } = await q
  if (error) throw toAppError(error)
  return ((data ?? []) as DbShiftRow[]).map(dbRowToShift)
}

// ─── Activity feed ───────────────────────────────────────────────────────────

export interface ActivityQuery {
  userId?: string
  actionLike?: string         // e.g. "refund.%"
  severity?: "info" | "warning" | "error"
  sinceMinutes?: number
  limit?: number
}

export async function listStaffActivity(q: ActivityQuery = {}): Promise<StaffActivity[]> {
  const supabase = createClient()
  const since = q.sinceMinutes
    ? new Date(Date.now() - q.sinceMinutes * 60_000).toISOString()
    : null

  // Primary path — dedicated RPC defined in migration 010.
  const rpc = await supabase.rpc("list_staff_activity", {
    p_user_id:     q.userId    ?? null,
    p_action_like: q.actionLike ?? null,
    p_severity:    q.severity  ?? null,
    p_since:       since,
    p_limit:       q.limit     ?? 50,
  })
  if (!rpc.error) {
    return ((rpc.data ?? []) as DbStaffActivityRow[]).map(dbRowToActivity)
  }

  // Defensive fallback: when the RPC is missing (migration 010 not applied
  // yet on this Supabase project, or schema cache is stale) we query the
  // `audit_logs` table directly so the UI still renders instead of crashing.
  const code = (rpc.error as { code?: string }).code ?? ""
  const msg  = rpc.error.message ?? ""
  const isMissingFn = code === "PGRST202"
    || /could not find the function|function .* does not exist/i.test(msg)
  if (!isMissingFn) throw toAppError(rpc.error)

  let fallback = supabase
    .from("audit_logs")
    .select("id, action, severity, user_id, branch_id, entity_type, entity_id, meta, request_id, created_at")
    .order("created_at", { ascending: false })
    .limit(q.limit ?? 50)

  if (q.userId)     fallback = fallback.eq("user_id", q.userId)
  if (q.severity)   fallback = fallback.eq("severity", q.severity)
  if (q.actionLike) fallback = fallback.ilike("action", q.actionLike)
  if (since)        fallback = fallback.gte("created_at", since)

  const { data, error } = await fallback
  if (error) {
    // Last-resort: never surface a backend error during a live demo —
    // an empty timeline is gentler than a crash.
    return []
  }
  // audit_logs doesn't carry the joined staff_name the RPC adds — surface null.
  type AuditRow = Omit<DbStaffActivityRow, "staff_name">
  const rows: DbStaffActivityRow[] = ((data ?? []) as AuditRow[]).map((r) => ({
    ...r,
    staff_name: null,
  }))
  return rows.map(dbRowToActivity)
}

/** Convenience: today's refund events with full audit context. */
export async function listTodayRefunds(): Promise<StaffActivity[]> {
  const startOfDayMin = Math.floor((Date.now() - new Date().setHours(0, 0, 0, 0)) / 60_000)
  return listStaffActivity({
    actionLike: "refund.%",
    sinceMinutes: startOfDayMin + 5,  // +5 grace for edge-of-day inserts
    limit: 100,
  })
}
