import { toAppError } from "./errors"
import { createLogger } from "./logger"

const log = createLogger("retry")

// ─── Generic retry with exponential backoff + jitter ─────────────────────────

export interface RetryOpts {
  /** Max attempts including the first try. Default 3. */
  maxAttempts?: number
  /** Initial delay in ms. Default 250. */
  baseDelayMs?: number
  /** Cap on backoff. Default 5_000. */
  maxDelayMs?: number
  /** Multiplier per attempt. Default 2. */
  factor?: number
  /** Optional AbortSignal to cancel mid-flight. */
  signal?: AbortSignal
  /** Callback per attempt — useful for UI "retrying…" feedback. */
  onAttempt?: (attempt: number, error: unknown) => void
  /** Decide whether to retry — default: rely on AppError.retryable. */
  shouldRetry?: (error: unknown, attempt: number) => boolean
  /** Logical label for log lines. */
  label?: string
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"))
    const id = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => { clearTimeout(id); reject(new Error("aborted")) })
  })
}

/**
 * Execute `op()` up to `maxAttempts` times with exponential backoff + jitter.
 * Each retry only fires when the error is *retryable*.
 */
export async function withRetry<T>(op: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 250,
    maxDelayMs  = 5_000,
    factor      = 2,
    signal,
    onAttempt,
    shouldRetry,
    label       = "op",
  } = opts

  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op()
    } catch (raw) {
      const err = toAppError(raw)
      lastErr = err
      onAttempt?.(attempt, err)

      const isLast = attempt === maxAttempts
      const allow  = shouldRetry ? shouldRetry(err, attempt) : err.retryable

      if (isLast || !allow) {
        log.warn(`${label}: giving up after ${attempt} attempt(s)`, { code: err.code }, err)
        throw err
      }

      // Backoff with full jitter.
      const ceil = Math.min(maxDelayMs, baseDelayMs * factor ** (attempt - 1))
      const wait = Math.random() * ceil
      log.debug(`${label}: retrying in ${Math.round(wait)}ms`, { attempt, code: err.code })

      try { await sleep(wait, signal) }
      catch { throw err }
    }
  }
  // unreachable, but TS wants it
  throw lastErr
}
