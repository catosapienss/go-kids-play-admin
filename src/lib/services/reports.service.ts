import { createClient } from "@/lib/supabase/client"
import { safeReadRpc } from "@/lib/reliability/safe-rpc"
import {
  normalizeRevenuePeriods, dbRowToRevenueDay, dbRowToPeakHour,
  normalizeInsights, normalizeOrgAnalytics, normalizePackagePerformance,
  dbRowToStaffPerf, normalizeRevenueByCategory,
  type DateRange, type RevenuePeriods, type RevenueDayPoint, type PeakHourCell,
  type CustomerInsights, type OrgAnalytics, type PackagePerformance,
  type StaffPerformanceRow,
  type DbRevenueDayRow, type DbPeakHourRow, type DbStaffPerfRow,
  type RawRevenuePeriods, type RawRevenueByCategory, type RevenueByCategory,
} from "@/types/reports"

// ─── Helper: range → RPC params ──────────────────────────────────────────────

function rpcRange(r?: DateRange): { p_from: string | null; p_to: string | null } {
  return r
    ? { p_from: r.from.toISOString(), p_to: r.to.toISOString() }
    : { p_from: null, p_to: null }
}

// ─── Sensible empty defaults (used when migration 012 is not yet applied) ────

const EMPTY_PERIOD = { gross: 0, net: 0, cash: 0, card: 0, wallet: 0, tx_count: 0, refunded: 0, session_count: 0 }
const EMPTY_REVENUE_PERIODS: RawRevenuePeriods = {
  today: EMPTY_PERIOD, yesterday: EMPTY_PERIOD,
  week: EMPTY_PERIOD,  prev_week: EMPTY_PERIOD,
  month: EMPTY_PERIOD, prev_month: EMPTY_PERIOD,
  year: EMPTY_PERIOD,
}

// ─── Revenue periods (today / week / month / year + priors) ──────────────────

export async function getRevenuePeriods(): Promise<RevenuePeriods> {
  const supabase = createClient()
  const data = await safeReadRpc<RawRevenuePeriods, RawRevenuePeriods>(
    () => supabase.rpc("get_revenue_periods"),
    { fallback: EMPTY_REVENUE_PERIODS, label: "get_revenue_periods" },
  )
  return normalizeRevenuePeriods(data)
}

// ─── Revenue breakdown (per-day in range) ────────────────────────────────────

export async function getRevenueBreakdown(range?: DateRange): Promise<RevenueDayPoint[]> {
  const supabase = createClient()
  const data = await safeReadRpc<DbRevenueDayRow[], DbRevenueDayRow[]>(
    () => supabase.rpc("get_revenue_breakdown", rpcRange(range)),
    { fallback: [], label: "get_revenue_breakdown" },
  )
  return (data ?? []).map(dbRowToRevenueDay)
}

// ─── Revenue by category (donut — migration 037) ─────────────────────────────

const EMPTY_REVENUE_BY_CATEGORY: RawRevenueByCategory = {
  sessions: 0, retail: 0, memberships: 0, birthdays: 0, total: 0,
}

export async function getRevenueByCategory(range?: DateRange): Promise<RevenueByCategory> {
  const supabase = createClient()
  const data = await safeReadRpc<RawRevenueByCategory, RawRevenueByCategory>(
    () => supabase.rpc("revenue_by_category", rpcRange(range)),
    { fallback: EMPTY_REVENUE_BY_CATEGORY, label: "revenue_by_category" },
  )
  return normalizeRevenueByCategory(data)
}

// ─── Peak hours heatmap ──────────────────────────────────────────────────────

export async function getPeakHoursHeatmap(range?: DateRange): Promise<PeakHourCell[]> {
  const supabase = createClient()
  const data = await safeReadRpc<DbPeakHourRow[], DbPeakHourRow[]>(
    () => supabase.rpc("get_peak_hours_heatmap", rpcRange(range)),
    { fallback: [], label: "get_peak_hours_heatmap" },
  )
  return (data ?? []).map(dbRowToPeakHour)
}

// ─── Customer insights ───────────────────────────────────────────────────────

// Defined inline because the type isn't exported from @/types/reports.
type RawCustomerInsightsType = Parameters<typeof normalizeInsights>[0]
const EMPTY_INSIGHTS: RawCustomerInsightsType = {
  total_customers: 0, active_in_range: 0, returning: 0, returning_rate: 0,
  vip_count: 0, vip_ratio: 0, avg_spend: 0, total_visits: 0, top_spenders: [],
}

export async function getCustomerInsights(range?: DateRange): Promise<CustomerInsights> {
  const supabase = createClient()
  const data = await safeReadRpc<RawCustomerInsightsType, RawCustomerInsightsType>(
    () => supabase.rpc("get_customer_insights", rpcRange(range)),
    { fallback: EMPTY_INSIGHTS, label: "get_customer_insights" },
  )
  return normalizeInsights(data)
}

// ─── Organization analytics ──────────────────────────────────────────────────

type RawOrgAnalyticsType = Parameters<typeof normalizeOrgAnalytics>[0]
const EMPTY_ORG_ANALYTICS: RawOrgAnalyticsType = {
  count: 0, avg_children: 0, revenue: 0, upcoming: 0, busy_days: [],
}

export async function getOrganizationAnalytics(range?: DateRange): Promise<OrgAnalytics> {
  const supabase = createClient()
  const data = await safeReadRpc<RawOrgAnalyticsType, RawOrgAnalyticsType>(
    () => supabase.rpc("get_organization_analytics", rpcRange(range)),
    { fallback: EMPTY_ORG_ANALYTICS, label: "get_organization_analytics" },
  )
  return normalizeOrgAnalytics(data)
}

// ─── Package performance ─────────────────────────────────────────────────────

type RawPackagePerfType = Parameters<typeof normalizePackagePerformance>[0]
const EMPTY_PACKAGE_PERF: RawPackagePerfType = {
  buckets: [], unlimited_share: 0, extension_rate: 0, avg_duration: 0,
}

export async function getPackagePerformance(range?: DateRange): Promise<PackagePerformance> {
  const supabase = createClient()
  const data = await safeReadRpc<RawPackagePerfType, RawPackagePerfType>(
    () => supabase.rpc("get_package_performance", rpcRange(range)),
    { fallback: EMPTY_PACKAGE_PERF, label: "get_package_performance" },
  )
  return normalizePackagePerformance(data)
}

// ─── Staff performance ───────────────────────────────────────────────────────

export async function getStaffPerformance(range?: DateRange): Promise<StaffPerformanceRow[]> {
  const supabase = createClient()
  const data = await safeReadRpc<DbStaffPerfRow[], DbStaffPerfRow[]>(
    () => supabase.rpc("get_staff_performance", rpcRange(range)),
    { fallback: [], label: "get_staff_performance" },
  )
  return (data ?? []).map(dbRowToStaffPerf)
}

// ─── CSV export foundation ────────────────────────────────────────────────────
//
// Tiny helper that builds a CSV blob client-side and triggers a download.
// Foundation only — for now any panel can call this with whatever rows it has;
// the future evolution swaps this for a server-side endpoint that streams
// large datasets and supports XLSX/PDF.

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>): void {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown): string => {
    if (v == null) return ""
    const s = String(v)
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(";")),
  ]
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
