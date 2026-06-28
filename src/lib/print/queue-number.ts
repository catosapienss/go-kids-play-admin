// ─── Daily queue number ──────────────────────────────────────────────────────
//
// Sequential per-day label number, resets at midnight (TR local time). Stored
// in localStorage so it survives reloads. Pure UI helper — never written to
// Supabase, never affects financial rows.

const STORAGE_KEY = "gkp_label_queue"

interface QueueState {
  day:   string   // YYYY-MM-DD
  next:  number   // next number to issue
}

function todayKey(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, "0")
  const dd   = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function load(): QueueState {
  if (typeof window === "undefined") return { day: todayKey(), next: 1 }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { day: todayKey(), next: 1 }
    const parsed = JSON.parse(raw) as QueueState
    if (parsed.day !== todayKey()) return { day: todayKey(), next: 1 }
    return parsed
  } catch {
    return { day: todayKey(), next: 1 }
  }
}

function save(state: QueueState): void {
  if (typeof window === "undefined") return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* noop */ }
}

/** Issue and consume the next number. Returns "001", "002", … */
export function nextQueueNumber(): string {
  const s = load()
  const n = s.next
  save({ day: s.day, next: s.next + 1 })
  return String(n).padStart(3, "0")
}

/** Peek the next number without consuming it. */
export function peekQueueNumber(): string {
  return String(load().next).padStart(3, "0")
}

/** Manually reset the counter (used by /ayarlar or end-of-day flow). */
export function resetQueueNumber(): void {
  save({ day: todayKey(), next: 1 })
}

// ─── Per-session memory ──────────────────────────────────────────────────────
//
// Remembers the queue number that was issued for a given session.id so
// reprint clicks stamp the same number on the new labels.

const SESSION_KEY = "gkp_label_session_queue"

type SessionMap = Record<string, string>

function loadSessionMap(): SessionMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as SessionMap
  } catch { return {} }
}

function saveSessionMap(m: SessionMap): void {
  if (typeof window === "undefined") return
  try { window.localStorage.setItem(SESSION_KEY, JSON.stringify(m)) } catch { /* noop */ }
}

/** Bind a queue number to a session id (called by the post-register flow). */
export function rememberSessionQueueNumber(sessionId: string, number: string): void {
  const m = loadSessionMap()
  m[sessionId] = number
  saveSessionMap(m)
}

/** Look up the queue number bound to a session id. Falls back to a fresh
 *  number if the session predates this feature (so reprint never fails). */
export function getOrAssignSessionQueueNumber(sessionId: string): string {
  const m = loadSessionMap()
  if (m[sessionId]) return m[sessionId]
  const fresh = nextQueueNumber()
  m[sessionId] = fresh
  saveSessionMap(m)
  return fresh
}

