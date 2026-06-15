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
  const { data, error } = await supabase
    .from("parents")
    .insert({
      full_name: input.full_name,
      phone: input.phone,
      notes: input.notes ?? null,
    })
    .select()
    .single()

  if (error) throw error

  void recordAudit({
    action: "customer.create",
    severity: "info",
    entityType: "parent",
    entityId: data.id,
    meta: { fullName: input.full_name, phone: input.phone },
  })

  return { ...data, children: [] } as ParentWithChildren
}

export async function createChild(input: CreateChildInput): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("children")
    .insert({
      parent_id: input.parent_id,
      full_name: input.full_name,
      age: input.age,
      allergies: input.allergies ?? null,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id as string
}

export async function createSession(input: CreateSessionInput): Promise<DbSession> {
  const supabase = createClient()
  const startTime = new Date().toISOString()
  const endTime = input.duration_minutes === 0
    ? null
    : new Date(Date.now() + input.duration_minutes * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("sessions")
    .insert({
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
    })
    .select()
    .single()

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
