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

export async function endSession(sessionId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("end_session", { p_session_id: sessionId })
  if (error) throw error
}
