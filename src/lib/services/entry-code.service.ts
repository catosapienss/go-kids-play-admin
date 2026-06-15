import { createClient } from "@/lib/supabase/client"
import { createLogger } from "@/lib/reliability/logger"
import { recordAudit } from "@/lib/reliability/audit-log"

const log = createLogger("entry-code")

// ─── Entry Code (manual / future QR) Service ─────────────────────────────────
//
// Today: short human-readable codes ("PLAY-1234"). Cashier types them.
// Tomorrow: the *same* server contract handles QR payloads — the UI just
// switches input methods.

export interface ParentLite {
  id: string
  full_name: string
  phone: string
  wallet_balance: number
}

export interface ChildLite {
  id: string
  parent_id: string
  name: string
  age: number
}

export type LookupResult =
  | { ok: true;  code: string; parent: ParentLite; children: ChildLite[] }
  | { ok: false; reason: "not_found" | "revoked" | "expired" }

interface RawLookup {
  ok: boolean
  reason?: "not_found" | "revoked" | "expired"
  code?: string
  parent?: ParentLite
  children?: ChildLite[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise user input: trim, uppercase, allow with or without dash. */
export function normalizeCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/\s+/g, "").replace(/-/g, "")
  if (cleaned.length < 4) return cleaned
  // Detect prefix length (PLAY=4, GKP=3, KID=3) so "PLAY1234" → "PLAY-1234".
  for (const p of ["PLAY", "GKP", "KID"]) {
    if (cleaned.startsWith(p)) return `${p}-${cleaned.slice(p.length)}`
  }
  return raw.toUpperCase().trim()
}

export function isPlausibleCode(raw: string): boolean {
  const code = normalizeCode(raw)
  return /^(PLAY|GKP|KID)-\d{3,5}$/.test(code)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the active entry code for a parent, creating one if needed.
 * Idempotent — repeated calls with the same parent return the same code.
 */
export async function getOrCreateEntryCode(parentId: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_or_create_entry_code", {
    p_parent_id: parentId,
  })
  if (error) throw error
  const code = String(data)

  log.info("entry-code: ready", { parentId, code })
  void recordAudit({
    action: "entry_code.issue",
    entityType: "parent",
    entityId: parentId,
    meta: { code },
  })
  return code
}

/**
 * Look up a parent (+ their children) by entry code. Returns a tagged result;
 * callers should branch on `result.ok`.
 */
export async function lookupEntryCode(rawCode: string): Promise<LookupResult> {
  const code = normalizeCode(rawCode)
  const supabase = createClient()
  const { data, error } = await supabase.rpc("lookup_entry_code", {
    p_code: code,
  })
  if (error) throw error
  const r = data as RawLookup

  if (!r.ok) {
    log.info("entry-code: lookup miss", { code, reason: r.reason })
    return { ok: false, reason: r.reason ?? "not_found" }
  }
  return {
    ok: true,
    code: r.code ?? code,
    parent: r.parent as ParentLite,
    children: (r.children as ChildLite[]) ?? [],
  }
}

/** Optional helper for future single-use codes — perpetual codes don't need this. */
export async function consumeEntryCode(rawCode: string): Promise<void> {
  const code = normalizeCode(rawCode)
  const supabase = createClient()
  const { error } = await supabase.rpc("consume_entry_code", { p_code: code })
  if (error) throw error
}

// ─── Client-side code generator (used when the SQL migration isn't applied yet) ──
//
// Demo / dev fallback. Same format as the server-side RPC so the UI is
// consistent regardless of whether migration 008 has been run.

export function generateClientSideCode(): string {
  const prefixes = ["PLAY", "GKP", "KID"]
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const digits = String(Math.floor(Math.random() * 10000)).padStart(4, "0")
  return `${prefix}-${digits}`
}
