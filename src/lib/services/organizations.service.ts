import { createClient } from "@/lib/supabase/client"
import {
  type PackageTier, type PackageExtra, type BirthdayPackage,
  isWeekendDate, includedCapacity, computePrice,
  type PriceInput, type PriceBreakdown,
} from "./birthday-pricing"

// Re-export the pure pricing layer so existing importers of the service keep
// working unchanged (the arithmetic now lives in ./birthday-pricing).
export type { PackageTier, PackageExtra, BirthdayPackage, PriceInput, PriceBreakdown }
export { isWeekendDate, includedCapacity, computePrice }

// ─── Birthday packages (v2 — STANDART / PREMIUM) ─────────────────────────────
//
// The catalog is DB-driven (`birthday_packages`). v2 adds weekday/weekend
// pricing, a tier, capacity rules, optional premium add-ons and notes. Old
// packages remain in the table (archived, is_active=false) purely so historical
// reservations keep resolving their original name/price.

interface DbPackageRow {
  id: string
  name: string
  description: string | null
  price: number
  is_active: boolean
  sort_order: number
  tier: string | null
  weekday_price: number | null
  weekend_price: number | null
  included_adults: number | null
  included_children: number | null
  included_total: number | null
  extra_person_price: number | null
  extra_person_vat_pct: number | null
  includes: unknown
  extras: unknown
  important_notes: string | null
}

function toPackage(r: DbPackageRow): BirthdayPackage {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    price: Number(r.price ?? 0),
    isActive: r.is_active,
    sortOrder: r.sort_order ?? 0,
    tier: (r.tier as PackageTier | null) ?? null,
    weekdayPrice: r.weekday_price != null ? Number(r.weekday_price) : null,
    weekendPrice: r.weekend_price != null ? Number(r.weekend_price) : null,
    includedAdults: r.included_adults,
    includedChildren: r.included_children,
    includedTotal: r.included_total,
    extraPersonPrice: r.extra_person_price != null ? Number(r.extra_person_price) : null,
    extraPersonVatPct: r.extra_person_vat_pct != null ? Number(r.extra_person_vat_pct) : null,
    includes: Array.isArray(r.includes) ? (r.includes as string[]) : [],
    extras: Array.isArray(r.extras) ? (r.extras as PackageExtra[]) : [],
    importantNotes: r.important_notes,
  }
}

/** All columns needed to describe a package fully. */
const PACKAGE_COLS =
  "id, name, description, price, is_active, sort_order, tier, weekday_price, weekend_price, " +
  "included_adults, included_children, included_total, extra_person_price, extra_person_vat_pct, " +
  "includes, extras, important_notes"

/** Legacy columns present before migration 038 — used as a fallback so the
 *  birthday module keeps working if the v2 columns aren't deployed yet. */
const LEGACY_PACKAGE_COLS = "id, name, description, price, is_active, sort_order"

/** True when a Postgres/PostgREST error means "column does not exist" (i.e. the
 *  v2 migration hasn't been applied to this database yet). */
function isMissingColumn(err: unknown): boolean {
  const msg = (err as { message?: string })?.message?.toLowerCase() ?? ""
  const code = (err as { code?: string })?.code ?? ""
  return code === "42703" || msg.includes("column") && msg.includes("does not exist")
}

/** Active packages selectable for NEW reservations, ordered for display.
 *  Falls back to the legacy shape when the v2 columns aren't present yet, so a
 *  Preview deploy never white-screens ahead of the migration. */
export async function listActiveBirthdayPackages(): Promise<BirthdayPackage[]> {
  const supabase = createClient()
  const full = await supabase
    .from("birthday_packages")
    .select(PACKAGE_COLS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
  if (!full.error) return (full.data ?? []).map((r) => toPackage(r as unknown as DbPackageRow))
  if (!isMissingColumn(full.error)) throw full.error

  // Pre-migration fallback: read legacy columns, synthesize a minimal package.
  const legacy = await supabase
    .from("birthday_packages")
    .select(LEGACY_PACKAGE_COLS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
  if (legacy.error) throw legacy.error
  return (legacy.data ?? []).map((r) => toPackage(r as unknown as DbPackageRow))
}

/** A single package by id (active or archived) — used on the detail page so a
 *  historical reservation can still show its original package. */
export async function getBirthdayPackage(id: string): Promise<BirthdayPackage | null> {
  const supabase = createClient()
  const full = await supabase.from("birthday_packages").select(PACKAGE_COLS).eq("id", id).maybeSingle()
  if (!full.error) return full.data ? toPackage(full.data as unknown as DbPackageRow) : null
  if (!isMissingColumn(full.error)) throw full.error

  const legacy = await supabase.from("birthday_packages").select(LEGACY_PACKAGE_COLS).eq("id", id).maybeSingle()
  if (legacy.error) throw legacy.error
  return legacy.data ? toPackage(legacy.data as unknown as DbPackageRow) : null
}

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
  // v2 snapshot / breakdown (nullable — old reservations predate these).
  package_name_snapshot: string | null
  package_tier: string | null
  is_weekend: boolean | null
  base_price: number | null
  adult_count: number | null
  child_count: number | null
  extra_guest_count: number | null
  extra_guest_charge: number | null
  extras: PackageExtra[] | null
  extras_total: number | null
  discount: number | null
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
  // v2 snapshot / breakdown — stored so the reservation is self-describing and
  // management can see exactly why the total differs from the base price.
  package_name_snapshot?: string | null
  package_tier?:      string | null
  is_weekend?:        boolean | null
  base_price?:        number | null
  adult_count?:       number | null
  child_count?:       number | null
  extra_guest_count?: number | null
  extra_guest_charge?: number | null
  extras?:            PackageExtra[] | null
  extras_total?:      number | null
  discount?:          number | null
}

export async function createOrganization(input: CreateOrganizationInput): Promise<OrganizationRow> {
  const supabase = createClient()
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id ?? null

  // Base columns that exist in every schema version. `total_price` always
  // carries the full contract total, so revenue reports are correct even if
  // the v2 breakdown columns aren't present yet.
  const base = {
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
  }
  const v2 = {
    package_name_snapshot: input.package_name_snapshot ?? null,
    package_tier:      input.package_tier ?? null,
    is_weekend:        input.is_weekend ?? null,
    base_price:        input.base_price ?? null,
    adult_count:       input.adult_count ?? null,
    child_count:       input.child_count ?? null,
    extra_guest_count: input.extra_guest_count ?? null,
    extra_guest_charge: input.extra_guest_charge ?? null,
    extras:            input.extras ?? null,
    extras_total:      input.extras_total ?? null,
    discount:          input.discount ?? null,
  }

  const full = await supabase.from("organizations").insert({ ...base, ...v2 }).select("*").single()
  if (!full.error) return full.data as OrganizationRow
  if (!isMissingColumn(full.error)) throw full.error

  // Pre-migration fallback: store the base row (with the full total_price) so
  // creation never fails ahead of the migration. The breakdown snapshot is
  // simply omitted until the v2 columns exist.
  const legacy = await supabase.from("organizations").insert(base).select("*").single()
  if (legacy.error) throw legacy.error
  return legacy.data as OrganizationRow
}

export async function listOrganizations(opts: { fromDate?: string } = {}): Promise<OrganizationRow[]> {
  const supabase = createClient()
  let q = supabase.from("organizations").select("*").order("event_date", { ascending: true })
  if (opts.fromDate) q = q.gte("event_date", opts.fromDate)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as OrganizationRow[]
}

/** Net paid amount per organization (payments − refunds), for a set of ids.
 *  Used by the list/calendar to show a payment-status badge without loading
 *  each reservation's full payment history. Best-effort: returns {} on error. */
export async function listOrgPaymentTotals(orgIds: string[]): Promise<Record<string, number>> {
  if (orgIds.length === 0) return {}
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("organization_payments")
      .select("organization_id, amount, kind")
      .in("organization_id", orgIds)
    if (error) throw error
    const totals: Record<string, number> = {}
    for (const p of data ?? []) {
      const id = p.organization_id as string
      const amt = Number(p.amount) * (p.kind === "refund" ? -1 : 1)
      totals[id] = (totals[id] ?? 0) + amt
    }
    return totals
  } catch {
    return {}
  }
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

// ─── Birthday revenue breakdown (management analysis) ────────────────────────
//
// Additive, read-only analysis over the v2 snapshot columns — NOT a
// replacement for the existing revenue RPCs. Revenue is recognised on
// `event_date` (same accounting rule as get_organization_analytics /
// revenue_by_category) and reads `total_price` for the grand total, so it
// agrees with the main reports to the lira. Cancelled reservations excluded.
//
// Rows created before v2 have no tier/breakdown → they land in `legacyRevenue`
// so the grand total still reconciles, without being miscategorised.

export interface BirthdayBreakdown {
  count: number
  standardCount: number
  premiumCount: number
  standardRevenue: number
  premiumRevenue: number
  weekdayRevenue: number
  weekendRevenue: number
  extrasRevenue: number
  extraGuestRevenue: number
  legacyRevenue: number
  totalRevenue: number
}

const EMPTY_BREAKDOWN: BirthdayBreakdown = {
  count: 0, standardCount: 0, premiumCount: 0, standardRevenue: 0, premiumRevenue: 0,
  weekdayRevenue: 0, weekendRevenue: 0, extrasRevenue: 0, extraGuestRevenue: 0,
  legacyRevenue: 0, totalRevenue: 0,
}

export async function getBirthdayBreakdown(range?: { from: Date; to: Date }): Promise<BirthdayBreakdown> {
  try {
    const supabase = createClient()
    let q = supabase
      .from("organizations")
      .select("event_date, status, total_price, package_tier, is_weekend, extras_total, extra_guest_charge")
      .neq("status", "cancelled")
    if (range) {
      q = q.gte("event_date", range.from.toISOString().slice(0, 10))
           .lte("event_date", range.to.toISOString().slice(0, 10))
    }
    const { data, error } = await q
    if (error) throw error

    const acc = { ...EMPTY_BREAKDOWN }
    for (const r of data ?? []) {
      const total = Number(r.total_price ?? 0)
      const tier = r.package_tier as string | null
      acc.count += 1
      acc.totalRevenue += total
      acc.extrasRevenue += Number(r.extras_total ?? 0)
      acc.extraGuestRevenue += Number(r.extra_guest_charge ?? 0)

      if (tier === "standard") { acc.standardCount += 1; acc.standardRevenue += total }
      else if (tier === "premium") { acc.premiumCount += 1; acc.premiumRevenue += total }
      else { acc.legacyRevenue += total }

      if (r.is_weekend === true) acc.weekendRevenue += total
      else if (r.is_weekend === false) acc.weekdayRevenue += total
    }
    return acc
  } catch {
    return { ...EMPTY_BREAKDOWN }
  }
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
