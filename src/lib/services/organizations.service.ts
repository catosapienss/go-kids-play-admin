import { createClient } from "@/lib/supabase/client"

// ─── Birthday Organizations service ──────────────────────────────────────────

export type OrgStatus = "pending" | "confirmed" | "completed" | "cancelled"

export interface OrganizationRow {
  id: string
  child_name: string
  child_age: number | null
  parent_id: string | null
  parent_name: string
  parent_phone: string | null
  package_id: string | null
  event_date: string
  event_time: string | null
  guest_count: number
  total_price: number
  status: OrgStatus
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface CreateOrganizationInput {
  child_name:   string
  child_age?:   number | null
  parent_name:  string
  parent_phone?: string | null
  parent_id?:   string | null
  package_id?:  string | null
  event_date:   string        // ISO yyyy-mm-dd
  event_time?:  string | null // hh:mm or null
  guest_count?: number
  total_price?: number
  notes?:       string | null
}

export async function createOrganization(input: CreateOrganizationInput): Promise<OrganizationRow> {
  const supabase = createClient()
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id ?? null

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      child_name:   input.child_name,
      child_age:    input.child_age ?? null,
      parent_id:    input.parent_id ?? null,
      parent_name:  input.parent_name,
      parent_phone: input.parent_phone ?? null,
      package_id:   input.package_id ?? null,
      event_date:   input.event_date,
      event_time:   input.event_time ?? null,
      guest_count:  input.guest_count ?? 0,
      total_price:  input.total_price ?? 0,
      status:       "pending",
      notes:        input.notes ?? null,
      created_by:   userId,
    })
    .select("*")
    .single()
  if (error) throw error
  return data as OrganizationRow
}

export async function listOrganizations(opts: { fromDate?: string } = {}): Promise<OrganizationRow[]> {
  const supabase = createClient()
  let q = supabase.from("organizations").select("*").order("event_date", { ascending: true })
  if (opts.fromDate) q = q.gte("event_date", opts.fromDate)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as OrganizationRow[]
}

export async function updateOrganizationStatus(id: string, status: OrgStatus): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("organizations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function deleteOrganization(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("organizations").delete().eq("id", id)
  if (error) throw error
}

export async function getOrganization(id: string): Promise<OrganizationRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return (data as OrganizationRow | null) ?? null
}

// ─── Organization payments ───────────────────────────────────────────────────

export type OrgPaymentMethod = "cash" | "card" | "transfer" | "wallet"
export type OrgPaymentKind   = "deposit" | "installment" | "full" | "refund"

export interface OrgPaymentRow {
  id: string
  organization_id: string
  amount: number
  method: OrgPaymentMethod
  kind: OrgPaymentKind
  note: string | null
  created_by: string | null
  created_at: string
}

export async function listOrgPayments(orgId: string): Promise<OrgPaymentRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("organization_payments")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as OrgPaymentRow[]
}

export async function addOrgPayment(input: {
  organization_id: string
  amount: number
  method: OrgPaymentMethod
  kind?: OrgPaymentKind
  note?: string | null
}): Promise<OrgPaymentRow> {
  const supabase = createClient()
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id ?? null
  const { data, error } = await supabase
    .from("organization_payments")
    .insert({
      organization_id: input.organization_id,
      amount:          input.amount,
      method:          input.method,
      kind:            input.kind ?? "deposit",
      note:            input.note ?? null,
      created_by:      userId,
    })
    .select("*")
    .single()
  if (error) throw error
  return data as OrgPaymentRow
}
