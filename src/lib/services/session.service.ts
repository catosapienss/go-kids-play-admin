import { createClient } from "@/lib/supabase/client"
import { computeRemaining, toPackageType } from "@/types/realtime"
import type { DbSessionRow } from "@/types/realtime"
import type { ActiveSession } from "@/types/aktif-oyun"

// Convert a raw DB row to the ActiveSession shape that all UI components expect
export function dbRowToActiveSession(row: DbSessionRow): ActiveSession {
  const remaining = computeRemaining(row)
  const entryDate = new Date(row.start_time)
  const entryTime = `${String(entryDate.getHours()).padStart(2, "0")}:${String(entryDate.getMinutes()).padStart(2, "0")}`

  return {
    id: row.id,
    childId: row.child_id ?? null,
    childName: row.child_name,
    childAge: row.child_age,
    parentId: row.parent_id ?? "",
    parentName: row.parent_name,
    parentPhone: row.parent_phone,
    entryTime,
    entryTimestamp: entryDate.getTime(),
    totalMinutes: row.duration_minutes === 0 ? 0 : row.duration_minutes,
    remainingSeconds: remaining,
    packageType: toPackageType(row.duration_minutes),
    staffName: row.staff_name,
    isVip: false,
    isPaused: row.status === "paused",
    childNotes: row.child_notes?.trim() ? row.child_notes.trim() : null,
    dailySeq: row.daily_seq ?? null,
  }
}

export async function fetchActiveSessions(): Promise<ActiveSession[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })

  if (error) throw error
  return ((data ?? []) as DbSessionRow[]).map(dbRowToActiveSession)
}

export async function extendSession(sessionId: string, minutes: number): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("extend_session", {
    p_session_id: sessionId,
    p_minutes: minutes,
  })
  if (error) throw error
}

export async function pauseSession(sessionId: string, remainingSeconds: number): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("pause_session", {
    p_session_id: sessionId,
    p_remaining_seconds: remainingSeconds,
  })
  if (error) throw error
}

export async function resumeSession(sessionId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("resume_session", { p_session_id: sessionId })
  if (error) throw error
}

/**
 * Update the staff note on an active session (sessions.child_notes) and keep
 * the child master record (children.notes) in sync so the note survives into
 * the next visit. Session update is the primary write; the children sync is
 * best-effort and never fails the call.
 */
export async function updateSessionChildNotes(
  sessionId: string,
  childId: string | null,
  notes: string | null,
): Promise<void> {
  const supabase = createClient()
  const value = notes?.trim() ? notes.trim() : null

  const { error } = await supabase
    .from("sessions")
    .update({ child_notes: value })
    .eq("id", sessionId)
  if (error) throw error

  if (childId) {
    void supabase
      .from("children")
      .update({ notes: value })
      .eq("id", childId)
      .then(({ error: e }) => {
        if (e) console.warn("[session] children.notes sync failed", e)
      })
  }
}

export async function endSession(sessionId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("end_session", { p_session_id: sessionId })
  if (error) throw error
}

// ─── Manual termination with reason ──────────────────────────────────────────
export type EndReason =
  | "time_expired"
  | "manual_exit"
  | "customer_left_early"
  | "parent_request"
  | "child_request"
  | "emergency"
  | "staff_decision"
  | "other"

export const END_REASON_LABELS: Record<EndReason, string> = {
  time_expired:        "Süresi Bitti",
  manual_exit:         "Manuel Çıkış",
  customer_left_early: "Müşteri erken ayrıldı",
  parent_request:      "Veli isteği",
  child_request:       "Çocuk isteği",
  emergency:           "Acil durum",
  staff_decision:      "Personel kararı",
  other:               "Diğer",
}

// Reasons surfaced in the Manuel Çıkış modal — `time_expired` is not in this
// list because it has its own one-tap action; `manual_exit` is the catch-all
// inside the modal alongside the granular ones.
export const MANUAL_END_REASONS: EndReason[] = [
  "time_expired",
  "customer_left_early",
  "parent_request",
  "child_request",
  "emergency",
  "staff_decision",
  "other",
]

export async function endSessionWithReason(
  sessionId: string,
  reason: EndReason,
  note?: string,
): Promise<{ session_id: string; ended_at: string; early_exit: boolean }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("end_session_with_reason", {
    p_session_id: sessionId,
    p_reason:     reason,
    p_note:       note ?? null,
  })
  if (error) throw error
  return data as { session_id: string; ended_at: string; early_exit: boolean }
}

// ─── Completion-log read model (manager history panel) ───────────────────────
export interface CompletionLogRow {
  id: string
  child_name: string
  parent_name: string
  parent_phone: string | null
  start_time: string
  planned_end: string | null
  actual_end: string | null
  duration_minutes: number
  end_reason: string | null
  end_note: string | null
  early_exit: boolean
  ended_by_name: string | null
  ended_by_username: string | null
}

export async function fetchCompletionLog(opts: {
  limit?: number
  filter?: "all" | "early" | "normal"
} = {}): Promise<CompletionLogRow[]> {
  const supabase = createClient()
  let q = supabase
    .from("session_completion_log")
    .select("*")
    .order("actual_end", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 50)

  if (opts.filter === "early")  q = q.eq("early_exit", true)
  if (opts.filter === "normal") q = q.eq("early_exit", false)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CompletionLogRow[]
}
