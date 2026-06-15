import { createClient } from "@/lib/supabase/client"
import { dbRowToBranch, type Branch, type DbBranchRow } from "@/types/branch"

// ─── Branch CRUD (foundation, read-heavy) ────────────────────────────────────

export async function listBranches(): Promise<Branch[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("status", "active")
    .order("branch_name", { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => dbRowToBranch(r as DbBranchRow))
}

export async function getBranch(id: string): Promise<Branch | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data ? dbRowToBranch(data as DbBranchRow) : null
}

export async function getBranchBySubdomain(subdomain: string): Promise<Branch | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("subdomain", subdomain)
    .maybeSingle()

  if (error) throw error
  return data ? dbRowToBranch(data as DbBranchRow) : null
}

// ─── Branch stats view (foundation for central analytics) ────────────────────
//
// The `branch_stats` view (migration 005) precomputes today's per-branch
// session count + revenue. Central analytics dashboards will read this.

export interface BranchStatsRow {
  id: string
  branchName: string
  branchCode: string
  status: string
  parentCount: number
  sessionCountToday: number
  revenueToday: number
}

export async function listBranchStats(): Promise<BranchStatsRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("branch_stats")
    .select("*")

  if (error) throw error
  return (data ?? []).map((r) => ({
    id:                r.id as string,
    branchName:        r.branch_name as string,
    branchCode:        r.branch_code as string,
    status:            r.status as string,
    parentCount:       Number(r.parent_count) || 0,
    sessionCountToday: Number(r.session_count_today) || 0,
    revenueToday:      Number(r.revenue_today) || 0,
  }))
}
