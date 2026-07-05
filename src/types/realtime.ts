// DB row returned by Supabase for sessions table (extended)
export interface DbSessionRow {
  id: string
  child_id: string | null
  child_name: string
  child_age: number
  parent_id: string | null
  parent_name: string
  parent_phone: string
  staff_name: string
  start_time: string
  end_time: string | null            // null = free play or paused
  duration_minutes: number           // 0 = free play
  paused_remaining_seconds: number | null
  status: "active" | "paused" | "completed"
  created_by: string | null
  created_at: string
  /** Staff note snapshot — exists once migration 019 is applied. */
  child_notes?: string | null
  /** Sequential per-day label number — exists once migration 020 is applied. */
  daily_seq?: number | null
}

// Union type for event type safety
export type RealtimeEventType =
  | "session_created"
  | "session_updated"
  | "session_ended"
  | "session_paused"
  | "session_resumed"
  | "session_extended"
  | "session_expired"
  | "payment_updated"
  | "duration_extended"

export interface RealtimeSessionEvent {
  id: string
  type: RealtimeEventType
  sessionId: string
  childName: string
  parentName: string
  staffName: string
  timestamp: Date
  meta?: Record<string, unknown>
}

// Maps duration_minutes to the UI package label
export function toPackageType(durationMinutes: number): "30dk" | "60dk" | "90dk" | "Serbest" {
  if (durationMinutes === 0) return "Serbest"
  if (durationMinutes <= 30) return "30dk"
  if (durationMinutes <= 60) return "60dk"
  return "90dk"
}

// Compute client-side remaining seconds from DB row
export function computeRemaining(row: Pick<DbSessionRow, "status" | "end_time" | "paused_remaining_seconds" | "duration_minutes">): number {
  if (row.duration_minutes === 0) return 999999    // free play sentinel
  if (row.status === "paused") return row.paused_remaining_seconds ?? 0
  if (!row.end_time) return 0
  return Math.max(0, Math.floor((new Date(row.end_time).getTime() - Date.now()) / 1000))
}
