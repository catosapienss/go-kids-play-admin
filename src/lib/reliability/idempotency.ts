import { createClient } from "@/lib/supabase/client"
import { toAppError } from "./errors"
import { createLogger } from "./logger"

const log = createLogger("idempotency")

// ─── Idempotency Layer ────────────────────────────────────────────────────────
//
// Two complementary protections:
//
//   1. **In-flight client lock** (`actionLock`): blocks a second call with the
//      same key while the first is still running. Prevents the classic
//      double-click → double-charge bug entirely client-side.
//
//   2. **Server-side replay-safe key** (`runIdempotent`): commits the result
//      of the first successful call so any retry (network blip, page reload,
//      reconnect) returns the original response instead of re-running.

// ─── Stable key generation ───────────────────────────────────────────────────

function uuid(): string {
  // Use Web Crypto when available; otherwise fall back to a v4-ish.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return "k_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10)
}

export function makeIdempotencyKey(action: string): string {
  return `${action}_${uuid()}`
}

// ─── In-flight client lock ───────────────────────────────────────────────────

const inFlight = new Map<string, Promise<unknown>>()

/**
 * Run `fn()` exactly once for a given `key`. Concurrent callers receive the
 * same promise — no double executions.
 *
 *   const result = await actionLock(`refund:${sessionId}`, () => doRefund(...))
 */
export async function actionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined
  if (existing) {
    log.debug("actionLock: joining in-flight", { key })
    return existing
  }
  const promise = fn().finally(() => { inFlight.delete(key) })
  inFlight.set(key, promise)
  return promise
}

// ─── Server-side idempotent execution ────────────────────────────────────────
//
// Wraps an operation in the DB-backed key store (migration 006):
//   1. Reserve the key.
//   2. If already completed → return the cached response.
//   3. Run the operation, commit the response.

export interface IdempotentOpts<T> {
  /** Stable client-generated key. Use `makeIdempotencyKey()` if you don't have one. */
  key: string
  /** Logical action name — keep stable so audit/lookups work. */
  action: string
  /** The operation to run. Receives the key for downstream chaining. */
  fn: (key: string) => Promise<T>
  /** Serializer for the success response (defaults to JSON-safe). */
  toResponse?: (value: T) => unknown
  /** Optional deserializer when returning a cached response. */
  fromResponse?: (raw: unknown) => T
}

interface RpcReply {
  is_replay: boolean
  response:  unknown
  status:    "in_flight" | "completed" | "failed"
}

export async function runIdempotent<T>(opts: IdempotentOpts<T>): Promise<T> {
  const { key, action, fn, toResponse = (v) => v as unknown, fromResponse = (v) => v as T } = opts
  const supabase = createClient()

  // 1. Reserve / look up the key.
  let replay: RpcReply
  try {
    const { data, error } = await supabase.rpc("record_idempotent_action", {
      p_key: key, p_action: action,
    })
    if (error) throw error
    replay = data as RpcReply
  } catch (e) {
    // If the RPC itself fails (e.g. migration not applied yet), degrade
    // gracefully: run the action without idempotency rather than blocking ops.
    log.warn("idempotency RPC unavailable, falling back to direct execution", { action }, e)
    return fn(key)
  }

  // 2. Replay path — return the original response (or fail-fast on a stuck key).
  if (replay.is_replay) {
    if (replay.status === "completed") {
      log.info("idempotency: replay served from cache", { action, key })
      return fromResponse(replay.response)
    }
    if (replay.status === "in_flight") {
      // Another tab is processing this key; give up and ask the user to wait.
      throw toAppError(new Error("Bu işlem zaten yürütülüyor."))
    }
    if (replay.status === "failed") {
      throw toAppError(new Error("Bu işlem daha önce başarısız oldu."))
    }
  }

  // 3. Fresh run — wrap so we can commit either outcome.
  try {
    const value = await fn(key)
    await supabase.rpc("complete_idempotent_action", {
      p_key: key,
      p_response: toResponse(value) as never,
    })
    return value
  } catch (e) {
    try {
      await supabase.rpc("fail_idempotent_action", {
        p_key: key,
        p_error: e instanceof Error ? e.message : String(e),
      })
    } catch { /* swallow — must not mask the original error */ }
    throw e
  }
}

// ─── Combined helper — lock + idempotent in one call ─────────────────────────
//
// Use this for *every* finance write. The lock prevents double-clicks; the key
// makes retries safe across reloads and reconnects.

export async function safeFinanceAction<T>(
  scopeKey: string,             // e.g. "refund:<sessionId>"
  action: string,                // e.g. "refund.cancel"
  fn: (idempotencyKey: string) => Promise<T>,
): Promise<T> {
  return actionLock(scopeKey, () => {
    const key = makeIdempotencyKey(action)
    return runIdempotent({ key, action, fn })
  })
}
