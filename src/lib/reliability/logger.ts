// ─── Internal Logger ──────────────────────────────────────────────────────────
//
// One funnel for every "something went wrong / something happened" message.
//
// Today: console + ring buffer (queryable from devtools as `__gkpLogs`).
// Tomorrow: swap `sinks` to fan-out to Sentry/Datadog/Logtail/etc. without
// touching call sites.

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogEntry {
  ts: number
  level: LogLevel
  scope: string
  message: string
  meta?: Record<string, unknown>
  err?: { name: string; message: string; stack?: string }
}

type Sink = (entry: LogEntry) => void

// ─── Ring buffer (bounded; cheap memory) ──────────────────────────────────────

const BUFFER_SIZE = 200
const buffer: LogEntry[] = []

function pushToBuffer(entry: LogEntry) {
  buffer.push(entry)
  if (buffer.length > BUFFER_SIZE) buffer.shift()
}

function consoleSink(entry: LogEntry) {
  if (typeof window === "undefined" && entry.level === "debug") return
  const prefix = `[${entry.scope}]`
  const fn = entry.level === "error" ? console.error
    : entry.level === "warn"  ? console.warn
    : entry.level === "info"  ? console.info
    : console.debug
  if (entry.err) {
    fn(prefix, entry.message, entry.meta ?? {}, entry.err)
  } else if (entry.meta) {
    fn(prefix, entry.message, entry.meta)
  } else {
    fn(prefix, entry.message)
  }
}

const sinks: Sink[] = [pushToBuffer, consoleSink]

/** Register an additional sink (e.g. Sentry adapter). */
export function addLogSink(sink: Sink): () => void {
  sinks.push(sink)
  return () => {
    const i = sinks.indexOf(sink)
    if (i >= 0) sinks.splice(i, 1)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info (message: string, meta?: Record<string, unknown>): void
  warn (message: string, meta?: Record<string, unknown>, err?: unknown): void
  error(message: string, meta?: Record<string, unknown>, err?: unknown): void
}

function normalizeError(e: unknown): LogEntry["err"] {
  if (!e) return undefined
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack }
  }
  try {
    return { name: "non-error", message: typeof e === "string" ? e : JSON.stringify(e) }
  } catch {
    return { name: "non-error", message: String(e) }
  }
}

function emit(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>, err?: unknown) {
  const entry: LogEntry = {
    ts: Date.now(),
    level,
    scope,
    message,
    ...(meta ? { meta } : {}),
    ...(err  ? { err: normalizeError(err) } : {}),
  }
  for (const s of sinks) {
    try { s(entry) } catch { /* swallow */ }
  }
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, meta)     => emit("debug", scope, m, meta),
    info:  (m, meta)     => emit("info",  scope, m, meta),
    warn:  (m, meta, e)  => emit("warn",  scope, m, meta, e),
    error: (m, meta, e)  => emit("error", scope, m, meta, e),
  }
}

/** Returns a shallow copy of the in-memory log buffer (for diagnostics UI). */
export function getRecentLogs(level?: LogLevel): LogEntry[] {
  return level
    ? buffer.filter((e) => e.level === level).slice()
    : buffer.slice()
}

// ─── Devtools hook ────────────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__gkpLogs = {
    recent: getRecentLogs,
    clear: () => { buffer.length = 0 },
  }
}

// ─── Singleton root logger ────────────────────────────────────────────────────

export const log = createLogger("app")
