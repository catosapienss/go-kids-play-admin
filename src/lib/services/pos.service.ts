import { createClient } from "@/lib/supabase/client"
import { recordAudit } from "@/lib/reliability/audit-log"
import type {
  ParentWithChildren,
  CreateParentInput,
  CreateChildInput,
  CreateSessionInput,
  CreatePaymentInput,
  DbSession,
} from "@/types/operations"

export async function searchParents(query: string): Promise<ParentWithChildren[]> {
  if (query.length < 2) return []
  const supabase = createClient()
  const normalized = query.replace(/\s/g, "")

  const { data, error } = await supabase
    .from("parents")
    .select("*, children(*)")
    .or(`phone.ilike.%${normalized}%,full_name.ilike.%${query}%`)
    .limit(10)

  if (error) throw error
  return (data ?? []) as ParentWithChildren[]
}

// ─── Phone as the unique customer key ────────────────────────────────────────
//
// Turkish numbers arrive in many shapes ("0532 123 45 67", "+90532…",
// "5321234567"). Collapse to the bare 10-digit subscriber number so the same
// person is always recognised regardless of how staff typed it.
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "")
  if (d.startsWith("90") && d.length === 12) d = d.slice(2)
  if (d.startsWith("0")  && d.length === 11) d = d.slice(1)
  return d
}

/**
 * Exact-match lookup by phone — the returning-customer fast path. Returns the
 * existing parent (with children) or null. Never creates anything.
 *
 * Uses a broad ilike prefilter (same limitation as searchParents for
 * space-formatted storage) then a strict normalized-equality check so we only
 * ever auto-load the ONE parent that truly owns this number.
 */
export async function getParentByPhone(phone: string): Promise<ParentWithChildren | null> {
  const norm = normalizePhone(phone)
  if (norm.length < 10) return null
  const supabase = createClient()
  const { data, error } = await supabase
    .from("parents")
    .select("*, children(*)")
    .ilike("phone", `%${norm}%`)
    .limit(10)
  if (error) throw error
  const rows = (data ?? []) as ParentWithChildren[]
  return rows.find((p) => normalizePhone(p.phone) === norm) ?? null
}

// ─── Returning-customer badge stats (read-only, tolerant) ───────────────────
export interface ParentQuickStats {
  visitCount:    number
  isVip:         boolean
  totalSpent:    number
  walletBalance: number
}

/** Light summary for the returning-customer badge. Reads customer_summary;
 *  returns null for brand-new parents (no row yet) or if the view is missing. */
export async function getParentQuickStats(parentId: string): Promise<ParentQuickStats | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("customer_summary")
      .select("visit_count, is_vip, total_spent, wallet_balance")
      .eq("id", parentId)
      .maybeSingle()
    if (error || !data) return null
    return {
      visitCount:    Number((data as { visit_count?: number | string }).visit_count) || 0,
      isVip:         !!(data as { is_vip?: boolean }).is_vip,
      totalSpent:    Number((data as { total_spent?: number | string }).total_spent) || 0,
      walletBalance: Number((data as { wallet_balance?: number | string }).wallet_balance) || 0,
    }
  } catch {
    return null
  }
}

export async function getRecentParents(limit = 6): Promise<ParentWithChildren[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("parents")
    .select("*, children(*)")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as ParentWithChildren[]
}

export async function createParent(input: CreateParentInput): Promise<ParentWithChildren> {
  const supabase = createClient()

  // Phone is the unique customer key — never create a second row for a number
  // that already exists. Check first, so a returning parent is reused instead
  // of erroring with "Registration failed".
  const existing = await getParentByPhone(input.phone).catch(() => null)
  if (existing) return existing

  const { data, error } = await supabase
    .from("parents")
    .insert({
      full_name: input.full_name,
      phone: input.phone,
      notes: input.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    // Lost a race (unique violation) — recover by loading the row that won.
    const msg = error.message ?? ""
    if (msg.includes("unique") || msg.includes("duplicate") || error.code === "23505") {
      const recovered = await getParentByPhone(input.phone).catch(() => null)
      if (recovered) return recovered
    }
    throw error
  }

  void recordAudit({
    action: "customer.create",
    severity: "info",
    entityType: "parent",
    entityId: data.id,
    meta: { fullName: input.full_name, phone: input.phone },
  })

  return { ...data, children: [] } as ParentWithChildren
}

// PostgREST rejects writes referencing columns missing from the schema cache.
// The notes columns arrive with migration 019 — until it runs on production,
// fall back to the note-less write so registration NEVER breaks.
function isMissingColumnError(err: unknown, column: string): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err)
  return msg.includes(column) && (msg.includes("column") || msg.includes("schema cache"))
}

export async function createChild(input: CreateChildInput): Promise<string> {
  const supabase = createClient()
  const base = {
    parent_id: input.parent_id,
    full_name: input.full_name,
    age: input.age,
    allergies: input.allergies ?? null,
  }
  const note = input.notes?.trim()
  const payload: Record<string, unknown> = { ...base }
  if (note) payload.notes = note

  let { data, error } = await supabase
    .from("children")
    .insert(payload)
    .select("id")
    .single()
  if (error && note && isMissingColumnError(error, "notes")) {
    // Migration 019 not applied yet — retry without the note.
    ;({ data, error } = await supabase.from("children").insert(base).select("id").single())
  }
  if (error) throw error
  return data!.id as string
}

/** Update the persistent note on a child master record (children.notes). */
export async function updateChildNotes(childId: string, notes: string | null): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("children")
    .update({ notes: notes?.trim() ? notes.trim() : null })
    .eq("id", childId)
  if (error) throw error

  void recordAudit({
    action: "child.note.update",
    severity: "info",
    entityType: "child",
    entityId: childId,
    meta: { notes: notes ?? null },
  })
}

export async function createSession(input: CreateSessionInput): Promise<DbSession> {
  const supabase = createClient()
  const startTime = new Date().toISOString()
  const endTime = input.duration_minutes === 0
    ? null
    : new Date(Date.now() + input.duration_minutes * 60 * 1000).toISOString()

  const base = {
    child_id: input.child_id,
    child_name: input.child_name,
    child_age: input.child_age,
    parent_id: input.parent_id,
    parent_name: input.parent_name,
    parent_phone: input.parent_phone,
    staff_name: input.staff_name,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: input.duration_minutes,
    remaining_minutes: input.duration_minutes,
    status: "active",
    created_by: input.created_by ?? null,
  }
  const note = input.child_notes?.trim()
  const payload: Record<string, unknown> = { ...base }
  if (note) payload.child_notes = note

  let { data, error } = await supabase
    .from("sessions")
    .insert(payload)
    .select()
    .single()
  if (error && note && isMissingColumnError(error, "child_notes")) {
    // Migration 019 not applied yet — retry without the note snapshot.
    ;({ data, error } = await supabase.from("sessions").insert(base).select().single())
  }

  if (error) throw error

  void recordAudit({
    action: "session.create",
    severity: "info",
    entityType: "session",
    entityId: data.id as string,
    meta: {
      childName:    input.child_name,
      childAge:     input.child_age,
      parentName:   input.parent_name,
      durationMin:  input.duration_minutes === 0 ? "unlimited" : input.duration_minutes,
      staffName:    input.staff_name,
    },
  })

  return data as DbSession
}

export async function createPayment(input: CreatePaymentInput): Promise<void> {
  const supabase = createClient()
  const total = input.cash_amount + input.card_amount + input.wallet_amount

  const { error } = await supabase.from("payments").insert({
    session_id: input.session_id,
    cash_amount: input.cash_amount,
    card_amount: input.card_amount,
    wallet_amount: input.wallet_amount,
    total_amount: total,
  })
  if (error) throw error

  void recordAudit({
    action: "payment.create",
    severity: "info",
    entityType: "payment",
    entityId: input.session_id,
    meta: {
      cash:   input.cash_amount,
      card:   input.card_amount,
      wallet: input.wallet_amount,
      total,
    },
  })
}

export async function deductWallet(parentId: string, amount: number): Promise<void> {
  if (amount <= 0) return
  const supabase = createClient()
  const { error } = await supabase.rpc("deduct_wallet", {
    p_parent_id: parentId,
    p_amount: amount,
  })
  if (error) throw error

  void recordAudit({
    action: "wallet.deduct",
    severity: "info",
    entityType: "parent",
    entityId: parentId,
    meta: { amount },
  })
}
