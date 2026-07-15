import { createClient } from "@/lib/supabase/client"

// ─── Campaign service (migration 035) ────────────────────────────────────────
//
// Owner-editable promotional campaigns. Phase-1 use: the Mon/Wed "60 dk al, 30 dk
// hediye" summer campaign, auto-applied on new registrations.

export interface Campaign {
  id: string
  name: string
  eligibleWeekdays: number[]        // 0=Sun..6=Sat
  eligiblePackageMinutes: number
  bonusMinutes: number
  startsOn: string | null
  endsOn: string | null
  active: boolean
  forNewRegistrations: boolean
  forExtensions: boolean
  combinableWithMemberships: boolean
}

export interface ApplicableCampaign {
  applies: boolean
  campaignId?: string
  campaignName?: string
  bonusMinutes?: number
}

function rowToCampaign(r: Record<string, unknown>): Campaign {
  return {
    id: r.id as string,
    name: (r.name as string) ?? "",
    eligibleWeekdays: (r.eligible_weekdays as number[]) ?? [],
    eligiblePackageMinutes: Number(r.eligible_package_minutes ?? 0),
    bonusMinutes: Number(r.bonus_minutes ?? 0),
    startsOn: (r.starts_on as string | null) ?? null,
    endsOn: (r.ends_on as string | null) ?? null,
    active: (r.active as boolean) ?? true,
    forNewRegistrations: (r.for_new_registrations as boolean) ?? true,
    forExtensions: (r.for_extensions as boolean) ?? false,
    combinableWithMemberships: (r.combinable_with_memberships as boolean) ?? false,
  }
}

export async function listCampaigns(): Promise<Campaign[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false })
    if (error) throw error
    return (data ?? []).map((r) => rowToCampaign(r as Record<string, unknown>))
  } catch { return [] }
}

/** The active campaign (if any) that applies to a new registration of this
 *  package length right now. Returns { applies:false } when none. */
export async function getApplicableCampaign(packageMinutes: number): Promise<ApplicableCampaign> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("applicable_campaign", { p_package_minutes: packageMinutes })
    if (error) throw error
    const j = (data ?? {}) as Record<string, unknown>
    if (!j.applies) return { applies: false }
    return {
      applies: true,
      campaignId: j.campaign_id as string,
      campaignName: j.campaign_name as string,
      bonusMinutes: Number(j.bonus_minutes ?? 0),
    }
  } catch { return { applies: false } }
}

export interface MembershipCampaignReport {
  membershipsSingle: number
  membershipsSibling: number
  membershipsSold: number
  membershipRevenue: number
  campaignSessions: number
  campaignPaidMinutes: number
  campaignBonusMinutes: number
  membershipSessions: number
  membershipWeekdayVisits: number
  membershipWeekendMinutes: number
}

/** Aggregated membership + campaign figures for a date range. Bonus minutes are
 *  reported separately and are NEVER part of revenue. */
export async function getMembershipCampaignReport(from: Date, to: Date): Promise<MembershipCampaignReport> {
  const empty: MembershipCampaignReport = {
    membershipsSingle: 0, membershipsSibling: 0, membershipsSold: 0, membershipRevenue: 0,
    campaignSessions: 0, campaignPaidMinutes: 0, campaignBonusMinutes: 0,
    membershipSessions: 0, membershipWeekdayVisits: 0, membershipWeekendMinutes: 0,
  }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("membership_campaign_report", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    })
    if (error) throw error
    const j = (data ?? {}) as Record<string, unknown>
    return {
      membershipsSingle: Number(j.memberships_single ?? 0),
      membershipsSibling: Number(j.memberships_sibling ?? 0),
      membershipsSold: Number(j.memberships_sold ?? 0),
      membershipRevenue: Number(j.membership_revenue ?? 0),
      campaignSessions: Number(j.campaign_sessions ?? 0),
      campaignPaidMinutes: Number(j.campaign_paid_minutes ?? 0),
      campaignBonusMinutes: Number(j.campaign_bonus_minutes ?? 0),
      membershipSessions: Number(j.membership_sessions ?? 0),
      membershipWeekdayVisits: Number(j.membership_weekday_visits ?? 0),
      membershipWeekendMinutes: Number(j.membership_weekend_minutes ?? 0),
    }
  } catch { return empty }
}

/** Owner-only: create/update a campaign. */
export async function upsertCampaign(c: Omit<Partial<Campaign>, "id"> & { id?: string | null }): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("upsert_campaign", {
    p_id: c.id ?? null,
    p_name: c.name,
    p_eligible_weekdays: c.eligibleWeekdays ?? [1, 3],
    p_eligible_package_minutes: c.eligiblePackageMinutes ?? 60,
    p_bonus_minutes: c.bonusMinutes ?? 30,
    p_starts_on: c.startsOn ?? null,
    p_ends_on: c.endsOn ?? null,
    p_active: c.active ?? true,
    p_for_new_registrations: c.forNewRegistrations ?? true,
    p_for_extensions: c.forExtensions ?? false,
    p_combinable_with_memberships: c.combinableWithMemberships ?? false,
  })
  if (error) {
    if (error.message?.includes("not_authorized")) throw new Error("Sadece yönetici düzenleyebilir")
    throw error
  }
  return data as string
}
