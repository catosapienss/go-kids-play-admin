import { createClient } from "@/lib/supabase/client"
import { createLogger } from "./logger"

const log = createLogger("audit")

// ─── Audit Log Service ────────────────────────────────────────────────────────
//
// Fire-and-forget writes to `audit_logs`. Always wrap so a logging failure
// never breaks the calling operation.

export type AuditSeverity = "info" | "warning" | "error"

export interface AuditEvent {
  action: string                            // "payment.create", "session.end", …
  severity?: AuditSeverity                  // default "info"
  entityType?: string                       // "session", "payment", …
  entityId?: string                         // uuid of the affected row
  meta?: Record<string, unknown>            // free-form structured details
  requestId?: string                        // ties multi-step flows together
}

// Best-effort: never throws.
export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("audit_logs").insert({
      action:      event.action,
      severity:    event.severity ?? "info",
      entity_type: event.entityType ?? null,
      entity_id:   event.entityId ?? null,
      meta:        event.meta ?? {},
      request_id:  event.requestId ?? null,
    })
    if (error) throw error
  } catch (e) {
    // Audit must never break the operation it's auditing.
    log.warn("audit write failed", { action: event.action }, e)
  }
}

/**
 * Convenience: wrap an async operation in audit bookends.
 * The operation's success/failure status is recorded automatically.
 */
export async function withAudit<T>(
  event: Omit<AuditEvent, "meta"> & { meta?: Record<string, unknown> },
  op: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await op()
    void recordAudit({
      ...event,
      severity: event.severity ?? "info",
      meta: { ...(event.meta ?? {}), ok: true, duration_ms: Date.now() - startedAt },
    })
    return result
  } catch (err) {
    void recordAudit({
      ...event,
      severity: "error",
      meta: {
        ...(event.meta ?? {}),
        ok: false,
        duration_ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    throw err
  }
}
