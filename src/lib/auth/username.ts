// ─── Username ↔ synthetic-email translation ──────────────────────────────────
//
// Supabase Auth requires an email. We don't want operators to see/type one.
// Convention: <username>@gokids.local  — never exposed in the UI, only used
// for the Supabase signInWithPassword call.

const DOMAIN = "gokids.local"

/** Strip whitespace, lowercase, drop invalid chars. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "")
}

/** True if the string already looks like a real email (contains "@"). */
export function looksLikeEmail(raw: string): boolean {
  return /@/.test(raw)
}

/** Convert a username (or legacy email) into the synthetic email Supabase uses. */
export function toAuthEmail(input: string): string {
  const v = input.trim()
  if (looksLikeEmail(v)) return v.toLowerCase()
  return `${normalizeUsername(v)}@${DOMAIN}`
}

/** Convert a stored auth email back to the display username. */
export function fromAuthEmail(email: string | null | undefined): string {
  if (!email) return ""
  const [local, domain] = email.split("@")
  if (domain === DOMAIN) return local
  return email
}
