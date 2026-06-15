import { createClient } from "@/lib/supabase/client"
import { toAppError } from "@/lib/reliability/errors"
import { lookupEntryCode } from "@/lib/services/entry-code.service"
import type { LookupResult, ParentLite, ChildLite } from "@/lib/services/entry-code.service"
import type { DbSessionRow } from "@/types/realtime"
import type { ActiveSession } from "@/types/aktif-oyun"
import { dbRowToActiveSession } from "@/lib/services/session.service"

// ─── Parent Portal Service ────────────────────────────────────────────────────
//
// Thin facade tailored to the customer-facing /parent route. We deliberately
// reuse the existing entry-code lookup + sessions queries instead of inventing
// a parallel auth surface — the QR migration story stays clean later.
//
// "Sign-in" today: the parent types their PLAY-XXXX code; the same RPC the
// cashier uses (`lookup_entry_code`) returns the parent + children bundle.
// The code is stashed in localStorage so subsequent app opens are instant.

export interface ParentBundle {
  code:     string
  parent:   ParentLite
  children: ChildLite[]
}

// ─── Sign-in (code-based) ────────────────────────────────────────────────────

export async function signInWithCode(rawCode: string): Promise<ParentBundle> {
  const r: LookupResult = await lookupEntryCode(rawCode)
  if (!r.ok) {
    const messages: Record<typeof r.reason, string> = {
      not_found: "Kod sistemde kayıtlı değil. Tesisteki kasiyerden kontrol etmesini isteyebilirsin.",
      revoked:   "Bu kod artık geçerli değil. Yeni bir kod için kasiyerden yardım al.",
      expired:   "Bu kodun süresi dolmuş. Kasiyerden yeni bir kod alabilirsin.",
    }
    throw new Error(messages[r.reason] ?? "Kod bulunamadı.")
  }
  return { code: r.code, parent: r.parent, children: r.children }
}

// ─── Active sessions for this parent's children ──────────────────────────────

export async function listParentActiveSessions(parentId: string): Promise<ActiveSession[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("parent_id", parentId)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })

  if (error) throw toAppError(error)
  return ((data ?? []) as DbSessionRow[]).map(dbRowToActiveSession)
}

// ─── Recent sessions (history strip) ─────────────────────────────────────────

export async function listParentRecentSessions(parentId: string, limit = 8): Promise<DbSessionRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw toAppError(error)
  return (data ?? []) as DbSessionRow[]
}

// ─── Wallet transactions for this parent ─────────────────────────────────────

export interface WalletTxRow {
  id: string
  type: "load" | "use" | "refund" | "bonus"
  amount: number
  description: string
  method: string | null
  created_at: string
}

export async function listParentWalletTransactions(parentId: string, limit = 20): Promise<WalletTxRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("id, type, amount, description, method, created_at")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw toAppError(error)
  return (data ?? []).map((r) => ({
    id: r.id as string,
    type: r.type as WalletTxRow["type"],
    amount: Number(r.amount),
    description: r.description as string,
    method: (r.method as string | null) ?? null,
    created_at: r.created_at as string,
  }))
}

// ─── Fresh parent record (for wallet balance refresh after operations) ───────

export async function refreshParent(parentId: string): Promise<ParentLite | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("parents")
    .select("id, full_name, phone, wallet_balance")
    .eq("id", parentId)
    .maybeSingle()
  if (error) throw toAppError(error)
  if (!data) return null
  return {
    id: data.id as string,
    full_name: data.full_name as string,
    phone: data.phone as string,
    wallet_balance: Number(data.wallet_balance) || 0,
  }
}

// ─── Notification preferences foundation ─────────────────────────────────────
//
// Reuses the shape defined in notification-channels.service.ts. Today these
// are local-only — when the real backend ships, swap localStorage for
// supabase.from("parent_notification_preferences").upsert(...).

const PREFS_KEY_PREFIX = "gkp:parent:prefs:"

export interface ParentPrefs {
  sessionStartedPush: boolean
  sessionExpiringPush: boolean
  walletLoadedPush: boolean
  organizationRemindPush: boolean
}

export const DEFAULT_PARENT_PREFS: ParentPrefs = {
  sessionStartedPush:     true,
  sessionExpiringPush:    true,
  walletLoadedPush:       true,
  organizationRemindPush: true,
}

export function readPrefs(parentId: string): ParentPrefs {
  if (typeof window === "undefined") return DEFAULT_PARENT_PREFS
  try {
    const raw = window.localStorage.getItem(PREFS_KEY_PREFIX + parentId)
    if (!raw) return DEFAULT_PARENT_PREFS
    return { ...DEFAULT_PARENT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PARENT_PREFS
  }
}

export function writePrefs(parentId: string, prefs: ParentPrefs): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PREFS_KEY_PREFIX + parentId, JSON.stringify(prefs))
  } catch { /* swallow */ }
}
