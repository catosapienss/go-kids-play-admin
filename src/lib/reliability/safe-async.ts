import { toast } from "sonner"
import { createLogger } from "./logger"
import { toAppError, type AppError } from "./errors"

const log = createLogger("safe-async")

// ─── safeAsync: one-stop wrapper for UI-triggered async actions ──────────────
//
// Normalises thrown values into AppError, logs them, optionally toasts a
// localized message, and returns a tagged Result so call sites can branch
// without try/catch noise.

export type Result<T> =
  | { ok: true;  value: T }
  | { ok: false; error: AppError }

export interface SafeAsyncOpts {
  /** Label for log lines. Highly recommended. */
  label: string
  /** Show a toast with `error.userMessage` on failure. Default true. */
  toastOnError?: boolean
  /** Override the toasted message. */
  toastMessage?: string
  /** Run extra logic after a failure (e.g. record audit). */
  onError?: (err: AppError) => void
}

export async function safeAsync<T>(
  op: () => Promise<T>,
  opts: SafeAsyncOpts,
): Promise<Result<T>> {
  const { label, toastOnError = true, toastMessage, onError } = opts
  try {
    const value = await op()
    return { ok: true, value }
  } catch (raw) {
    const error = toAppError(raw)
    log.error(`${label} failed`, { code: error.code }, error)
    if (toastOnError) {
      toast.error(toastMessage ?? error.userMessage)
    }
    try { onError?.(error) } catch { /* swallow */ }
    return { ok: false, error }
  }
}
