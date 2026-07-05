export type SessionStatus = "active" | "paused" | "expiring" | "expired"
export type PackageType = "30dk" | "60dk" | "90dk" | "Serbest"
export type EventType = "entry" | "exit" | "extend" | "pause" | "resume" | "expire"
export type FilterType = "all" | "expiring" | "vip" | "new" | "paused"

export interface ActiveSession {
  id: string
  childId: string | null
  childName: string
  childAge: number
  parentId: string
  parentName: string
  parentPhone: string
  entryTime: string
  entryTimestamp: number
  totalMinutes: number
  remainingSeconds: number
  packageType: PackageType
  staffName: string
  isVip: boolean
  isPaused: boolean
  /** Staff note ("Ateşe alerjisi var", "Çorap teslim edildi", …). */
  childNotes: string | null
  /** Sequential per-day label number (null for sessions predating migration 020). */
  dailySeq: number | null
}

export interface LiveEvent {
  id: string
  type: EventType
  childName: string
  parentName: string
  staffName: string
  timestamp: Date
  detail?: string
}

export function getStatus(session: ActiveSession): SessionStatus {
  if (session.isPaused) return "paused"
  if (session.remainingSeconds <= 0) return "expired"
  if (session.remainingSeconds <= 10 * 60) return "expiring"
  return "active"
}

export function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function elapsedMinutes(entryTimestamp: number): number {
  return Math.floor((Date.now() - entryTimestamp) / 60000)
}
