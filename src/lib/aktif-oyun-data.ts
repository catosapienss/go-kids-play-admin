import type { ActiveSession, LiveEvent, EventType } from "@/types/aktif-oyun"

// ─── Production stubs ────────────────────────────────────────────────────────
//
// All hardcoded sample sessions/events were removed. The real session store
// loads from Supabase (`fetchActiveSessions` in src/lib/stores/session-store).
// Only the static lookup tables (labels, colours) remain.

let _idCounter = 100
export function makeId() {
  return `s${++_idCounter}_${Math.random().toString(36).slice(2, 6)}`
}

export const INITIAL_SESSIONS: ActiveSession[] = []
export const INITIAL_EVENTS:   LiveEvent[]     = []

export const EVENT_LABELS: Record<EventType, string> = {
  entry:  "Giriş",
  exit:   "Çıkış",
  extend: "Süre Uzatma",
  pause:  "Duraklat",
  resume: "Devam Et",
  expire: "Süre Bitti",
}

export const EVENT_COLORS: Record<EventType, string> = {
  entry:  "bg-emerald-500",
  exit:   "bg-slate-400",
  extend: "bg-violet-500",
  pause:  "bg-amber-500",
  resume: "bg-sky-500",
  expire: "bg-red-500",
}
