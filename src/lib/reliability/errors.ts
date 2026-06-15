// ─── Typed Application Errors ────────────────────────────────────────────────
//
// Anything thrown by service code should ideally be an `AppError` so callers
// can branch on `.code` instead of string-matching `.message`.

export type AppErrorCode =
  | "network"          // offline, CORS, fetch fail
  | "auth"             // not authenticated, expired token
  | "forbidden"        // RLS / role rejected
  | "not-found"        // row missing
  | "validation"       // bad input
  | "conflict"         // duplicate / version conflict
  | "rate-limit"       // throttled
  | "supabase"         // unmapped Supabase error
  | "internal"         // catch-all

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly cause?: unknown
  readonly retryable: boolean
  readonly userMessage: string

  constructor(opts: {
    code: AppErrorCode
    message: string
    /** Localized fallback shown to the operator. */
    userMessage?: string
    retryable?: boolean
    cause?: unknown
  }) {
    super(opts.message)
    this.name = "AppError"
    this.code = opts.code
    this.cause = opts.cause
    this.retryable = opts.retryable ?? defaultRetryable(opts.code)
    this.userMessage = opts.userMessage ?? defaultUserMessage(opts.code)
  }
}

function defaultRetryable(code: AppErrorCode): boolean {
  return code === "network" || code === "rate-limit" || code === "supabase"
}

function defaultUserMessage(code: AppErrorCode): string {
  switch (code) {
    case "network":     return "Bağlantı sorunu. Tekrar deneyin."
    case "auth":        return "Oturumunuz sonlandı. Lütfen yeniden giriş yapın."
    case "forbidden":   return "Bu işlem için yetkiniz yok."
    case "not-found":   return "Kayıt bulunamadı."
    case "validation":  return "Bilgilerde eksik veya hatalı alan var."
    case "conflict":    return "Bu işlem zaten gerçekleşmiş."
    case "rate-limit":  return "Çok hızlı işlem. Lütfen biraz bekleyin."
    case "supabase":    return "Veritabanı geçici olarak yanıt vermiyor."
    case "internal":    return "Beklenmedik bir hata oluştu."
  }
}

// ─── Normalisation ────────────────────────────────────────────────────────────
//
// Convert any thrown value into an `AppError` so handlers have one shape.

interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string
  hint?: string
}

function isSupabaseError(e: unknown): e is SupabaseLikeError {
  return !!e && typeof e === "object" && ("code" in e || "details" in e || "hint" in e)
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e

  // Fetch / network
  if (e instanceof TypeError && /fetch|Network/i.test(e.message)) {
    return new AppError({ code: "network", message: e.message, cause: e })
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new AppError({ code: "network", message: "offline", cause: e })
  }

  // Supabase auth-token error
  if (e instanceof Error && /jwt|JWT|token/i.test(e.message)) {
    return new AppError({ code: "auth", message: e.message, cause: e })
  }

  // Supabase Postgrest error shape
  if (isSupabaseError(e)) {
    const code = e.code ?? ""
    if (code === "PGRST301" || code.startsWith("4")) {
      return new AppError({ code: "forbidden", message: e.message ?? "forbidden", cause: e })
    }
    if (code === "PGRST116") {
      return new AppError({ code: "not-found", message: e.message ?? "not found", cause: e })
    }
    if (code === "23505") {
      return new AppError({ code: "conflict", message: "duplicate key", cause: e })
    }
    return new AppError({ code: "supabase", message: e.message ?? "supabase error", cause: e })
  }

  if (e instanceof Error) {
    return new AppError({ code: "internal", message: e.message, cause: e })
  }

  return new AppError({ code: "internal", message: String(e), cause: e })
}
