import { toAppError } from "./errors"
import { createLogger } from "./logger"

const log = createLogger("safe-rpc")

// ─── safeReadRpc ──────────────────────────────────────────────────────────────
//
// Wraps a read-only Supabase RPC call. If the function doesn't exist on the
// server yet (migration not applied, schema cache stale) we return the
// caller-supplied fallback value instead of throwing — keeps dashboards
// rendering instead of crashing during live demos.
//
// IMPORTANT: This is for *read-only* RPCs (reports, lookups, aggregates).
// NEVER use this for finance writes (refund, extend, pay) — those must throw
// so the operator immediately knows the side-effect didn't land.

export interface SupabaseRpcResult<T> {
  data:  T | null
  error: { message?: string; code?: string } | null
}

export async function safeReadRpc<T, U = T>(
  exec: () => PromiseLike<SupabaseRpcResult<T>>,
  opts: {
    fallback: U
    label: string
  },
): Promise<T | U> {
  // PostgrestFilterBuilder is PromiseLike, not Promise — `await` unwraps both.
  const { data, error } = await exec()
  if (!error) return (data ?? opts.fallback) as T | U

  const code = error.code ?? ""
  const msg  = error.message ?? ""
  const missing = code === "PGRST202"
    || /could not find the function|function .* does not exist|schema cache/i.test(msg)

  if (missing) {
    log.warn(`${opts.label}: RPC missing — falling back`, { code, msg })
    return opts.fallback
  }

  // Genuine failure — surface as an AppError so error boundaries can react.
  throw toAppError(error)
}
