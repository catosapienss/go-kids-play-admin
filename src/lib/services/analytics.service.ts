import { createClient } from "@/lib/supabase/client"
import { withBranchScope, type BranchScope } from "@/lib/branch/scoped-query"

/**
 * Branch-aware mode for analytics.
 *
 * Every analytics query accepts an optional `scope`. When omitted, RLS still
 * scopes rows to the caller's branch — the explicit scope mainly matters for
 * super-admin viewers who have picked a specific branch in the switcher.
 */
/**
 * Internal helper — wraps a query with branch scope when `scope` is provided,
 * else leaves it unfiltered (RLS still applies on the server).
 *
 * Generic <T> preserves the input builder type for downstream chaining, while
 * the runtime path goes through the loosely-typed `withBranchScope` which only
 * needs `.eq(col, value)` and is therefore correct for every Supabase builder.
 */
function s<T>(query: T, scope?: BranchScope): T {
  if (!scope) return query
  // Safe at runtime: every Supabase filter-builder exposes `.eq(col, value)`
  // and returns itself for chaining. The cast collapses the deep generic that
  // would otherwise blow up the compiler.
  type AnyEq = { eq(col: string, value: unknown): AnyEq }
  return withBranchScope(query as unknown as AnyEq, scope) as unknown as T
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  todayEntries: number          // total sessions started today
  activeSessions: number        // currently active
  expiringSoon: number          // < 10 min remaining
  unlimitedActive: number       // free-play / unlimited active
  totalRevenue: number          // today — game + extension + retail
  totalCash: number             // cash REVENUE (game + extension + retail)
  totalCard: number             // card REVENUE (game + extension + retail)
  totalWallet: number           // wallet spent as tender on sessions
  walletLoaded: number          // total wallet top-ups (cash + card)
  totalRefunded: number
  netRevenue: number

  // ── Retail split (previously missing entirely from the dashboard) ──────────
  retailCash: number
  retailCard: number
  retailRevenue: number

  // ── POS terminal reconciliation ───────────────────────────────────────────
  // Wallet top-ups physically swipe the POS terminal but are NOT revenue
  // (they are prepaid credit). These fields let the Day-End panel show a card
  // figure that matches the physical terminal without double-counting revenue.
  walletCardLoaded: number      // card top-ups → hit the POS terminal
  walletCashLoaded: number      // cash top-ups → hit the drawer
  cardTendered: number          // totalCard + walletCardLoaded (match to POS)
  cashTendered: number          // totalCash + walletCashLoaded (match to drawer)
}

export interface HourlyBucket {
  hour: string                  // "09:00" .. "23:00"
  count: number                 // sessions started in that hour
  revenue: number               // revenue generated in that hour
}

export interface PaymentSplit {
  method: "cash" | "card" | "wallet"
  label: string
  amount: number
  share: number                 // 0..1
}

export interface RevenueDailyPoint {
  date: string                  // "Mon", "Tue" … or "12 May"
  revenue: number
  refunds: number
  net: number
}

export interface StaffMetric {
  staffName: string
  txCount: number               // payments processed
  revenue: number               // revenue handled
  cancellations: number         // refunds initiated by staff
}

export interface PackageMetric {
  packageType: "30dk" | "60dk" | "90dk" | "Serbest"
  label: string
  count: number
  share: number                 // 0..1
  revenue: number
}

export interface ExtensionMetric {
  totalExtensions: number
  extensionRate: number         // share of sessions that got extended (0..1)
  unlimitedConversions: number
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfToday(): Date { const d = new Date(); d.setHours(0,0,0,0); return d }
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x }
function daysAgo(n: number): Date { const d = startOfToday(); d.setDate(d.getDate() - n); return d }
function formatHourBucket(d: Date): string { return `${String(d.getHours()).padStart(2,"0")}:00` }
function formatShortDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })
}

// ─── Dashboard top metrics ────────────────────────────────────────────────────

export async function getDashboardMetrics(scope?: BranchScope): Promise<DashboardMetrics> {
  const supabase = createClient()
  const today = startOfToday()

  // ── Split the sessions query in two ────────────────────────────────────────
  // • "Aktif Oyun" is a live count of all sessions whose status is active or
  //   paused — date is irrelevant, a session started yesterday that is still
  //   running must still show here.
  // • "Bugün Giriş" is the number of sessions that *started* today.
  // Previously a single `.gte("created_at", today)` query drove both, which
  // hid overnight sessions from the live count.
  const [activeRes, todaySessionsRes, paymentsRes, walletTxsRes, refundsRes, retailRes] = await Promise.all([
    s(supabase.from("sessions").select("id, status, duration_minutes, end_time, paused_remaining_seconds, branch_id"), scope)
      .in("status", ["active", "paused"]),
    s(supabase.from("sessions").select("id, created_at, branch_id"), scope)
      .gte("created_at", today.toISOString()),
    s(supabase.from("payments").select("cash_amount, card_amount, wallet_amount, total_amount, branch_id"), scope)
      .gte("created_at", today.toISOString()),
    s(supabase.from("wallet_transactions").select("type, amount, method, branch_id"), scope)
      .gte("created_at", today.toISOString()),
    s(supabase.from("refund_logs").select("refund_amount, branch_id"), scope)
      .gte("created_at", today.toISOString()),
    // Retail sales tender the SAME physical POS terminal / cash drawer as
    // sessions. Omitting them was the root cause of the daily card mismatch
    // (a ₺50 sock paid by card showed on the terminal but not in the app).
    // Not branch-scoped: retail_sales.branch_id is not yet populated, so a
    // branch filter would silently drop every retail row.
    fetchTodayRetail(supabase, today),
  ])

  const liveSessions = activeRes.data ?? []
  const todaySessions = todaySessionsRes.data ?? []
  const payments = paymentsRes.data ?? []
  const walletTxs = walletTxsRes.data ?? []
  const refunds = refundsRes.data ?? []
  const retail = retailRes

  const now = Date.now()
  const remainingSec = (s: { status: string; end_time: string | null; paused_remaining_seconds: number | null; duration_minutes: number }) => {
    if (s.duration_minutes === 0) return 999999
    if (s.status === "paused") return s.paused_remaining_seconds ?? 0
    if (!s.end_time) return 0
    return Math.max(0, Math.floor((new Date(s.end_time).getTime() - now) / 1000))
  }

  const activeSessions = liveSessions.length
  const expiringSoon = liveSessions.filter((s) => s.duration_minutes > 0 && remainingSec(s) <= 600).length
  const unlimitedActive = liveSessions.filter((s) => s.duration_minutes === 0).length

  // Session + extension tender (payments table).
  const payCash = payments.reduce((s, p) => s + Number(p.cash_amount), 0)
  const payCard = payments.reduce((s, p) => s + Number(p.card_amount), 0)
  const totalWallet = payments.reduce((s, p) => s + Number(p.wallet_amount), 0)
  const payRevenue = payments.reduce((s, p) => s + Number(p.total_amount), 0)

  // Retail tender — folded into revenue (retail IS sales) so the dashboard
  // ciro finally reflects socks / snacks etc.
  const retailCash = retail.cash
  const retailCard = retail.card
  const retailRevenue = retail.total

  const totalCash = payCash + retailCash
  const totalCard = payCard + retailCard
  const totalRevenue = payRevenue + retailRevenue

  // Wallet top-ups split by tender (prepaid — NOT revenue, but they physically
  // hit the POS terminal / drawer, so they belong in the reconciliation figure).
  const loads = walletTxs.filter((t) => t.type === "load")
  const walletLoaded     = loads.reduce((s, t) => s + Number(t.amount), 0)
  const walletCardLoaded = loads.filter((t) => t.method === "card").reduce((s, t) => s + Number(t.amount), 0)
  const walletCashLoaded = loads.filter((t) => t.method === "cash").reduce((s, t) => s + Number(t.amount), 0)

  const totalRefunded = refunds.reduce((s, r) => s + Number(r.refund_amount), 0)

  return {
    todayEntries: todaySessions.length,
    activeSessions,
    expiringSoon,
    unlimitedActive,
    totalRevenue,
    totalCash,
    totalCard,
    totalWallet,
    walletLoaded,
    totalRefunded,
    netRevenue: totalRevenue - totalRefunded,
    retailCash,
    retailCard,
    retailRevenue,
    walletCardLoaded,
    walletCashLoaded,
    cardTendered: totalCard + walletCardLoaded,
    cashTendered: totalCash + walletCashLoaded,
  }
}

// ─── Retail tender helper ─────────────────────────────────────────────────────
//
// Sums today's non-voided retail sales by tender. Kept branch-agnostic because
// retail_sales.branch_id is not yet populated (single-branch production). If a
// branch column is later backfilled this can take the same `s(...)` scope.
async function fetchTodayRetail(
  supabase: ReturnType<typeof createClient>,
  today: Date,
): Promise<{ cash: number; card: number; total: number }> {
  try {
    const { data, error } = await supabase
      .from("retail_sales")
      .select("cash_amount, card_amount, total_amount, voided")
      .gte("sold_at", today.toISOString())
    if (error) throw error
    const live = (data ?? []).filter((r) => !(r as { voided?: boolean }).voided)
    return {
      cash:  live.reduce((s, r) => s + Number((r as { cash_amount?: number }).cash_amount ?? 0), 0),
      card:  live.reduce((s, r) => s + Number((r as { card_amount?: number }).card_amount ?? 0), 0),
      total: live.reduce((s, r) => s + Number((r as { total_amount?: number }).total_amount ?? 0), 0),
    }
  } catch {
    // retail_sales missing / RLS denied → contribute zero, never break the KPI.
    return { cash: 0, card: 0, total: 0 }
  }
}

// ─── Hourly heatmap (today) ───────────────────────────────────────────────────

export async function getHourlyHeatmap(scope?: BranchScope): Promise<HourlyBucket[]> {
  const supabase = createClient()
  const today = startOfToday()

  const [sessionsRes, paymentsRes] = await Promise.all([
    s(supabase.from("sessions").select("created_at, branch_id"), scope)
      .gte("created_at", today.toISOString()),
    s(supabase.from("payments").select("created_at, total_amount, branch_id"), scope)
      .gte("created_at", today.toISOString()),
  ])

  const buckets: Record<string, HourlyBucket> = {}
  // 09:00 .. 22:00 default window
  for (let h = 9; h <= 22; h++) {
    const key = `${String(h).padStart(2, "0")}:00`
    buckets[key] = { hour: key, count: 0, revenue: 0 }
  }

  for (const s of sessionsRes.data ?? []) {
    const k = formatHourBucket(new Date(s.created_at))
    if (!buckets[k]) buckets[k] = { hour: k, count: 0, revenue: 0 }
    buckets[k].count++
  }
  for (const p of paymentsRes.data ?? []) {
    const k = formatHourBucket(new Date(p.created_at))
    if (!buckets[k]) buckets[k] = { hour: k, count: 0, revenue: 0 }
    buckets[k].revenue += Number(p.total_amount)
  }

  return Object.values(buckets).sort((a, b) => a.hour.localeCompare(b.hour))
}

// ─── Daily revenue trend (last 7 days) ────────────────────────────────────────

export async function getDailyRevenueTrend(days = 7, scope?: BranchScope): Promise<RevenueDailyPoint[]> {
  const supabase = createClient()
  const since = daysAgo(days - 1)

  const [paymentsRes, refundsRes] = await Promise.all([
    s(supabase.from("payments").select("created_at, total_amount, branch_id"), scope)
      .gte("created_at", since.toISOString()),
    s(supabase.from("refund_logs").select("created_at, refund_amount, branch_id"), scope)
      .gte("created_at", since.toISOString()),
  ])

  const points: Record<string, RevenueDailyPoint> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = startOfDay(daysAgo(i))
    const key = formatShortDate(d)
    points[key] = { date: key, revenue: 0, refunds: 0, net: 0 }
  }

  for (const p of paymentsRes.data ?? []) {
    const key = formatShortDate(startOfDay(new Date(p.created_at)))
    if (points[key]) points[key].revenue += Number(p.total_amount)
  }
  for (const r of refundsRes.data ?? []) {
    const key = formatShortDate(startOfDay(new Date(r.created_at)))
    if (points[key]) points[key].refunds += Number(r.refund_amount)
  }

  return Object.values(points).map((p) => ({ ...p, net: p.revenue - p.refunds }))
}

// ─── Payment method split (today) ─────────────────────────────────────────────

export async function getPaymentSplit(scope?: BranchScope): Promise<PaymentSplit[]> {
  const supabase = createClient()
  const today = startOfToday()

  const [{ data }, retail] = await Promise.all([
    s(
      supabase.from("payments").select("cash_amount, card_amount, wallet_amount, branch_id"),
      scope,
    ).gte("created_at", today.toISOString()),
    // Fold retail tender in so the split matches the ciro KPI (which now
    // includes retail). Retail has no wallet portion.
    fetchTodayRetail(supabase, today),
  ])

  const rows = data ?? []
  const cash = rows.reduce((s, p) => s + Number(p.cash_amount), 0) + retail.cash
  const card = rows.reduce((s, p) => s + Number(p.card_amount), 0) + retail.card
  const wallet = rows.reduce((s, p) => s + Number(p.wallet_amount), 0)
  const total = cash + card + wallet || 1

  return [
    { method: "cash",   label: "Nakit",   amount: cash,   share: cash / total },
    { method: "card",   label: "Kart",    amount: card,   share: card / total },
    { method: "wallet", label: "Cüzdan",  amount: wallet, share: wallet / total },
  ]
}

// ─── Staff analytics (today) ──────────────────────────────────────────────────

export async function getStaffMetrics(scope?: BranchScope): Promise<StaffMetric[]> {
  const supabase = createClient()
  const today = startOfToday()

  const [sessionsRes, refundsRes] = await Promise.all([
    s(supabase.from("sessions").select("staff_name, branch_id"), scope)
      .gte("created_at", today.toISOString()),
    s(supabase.from("refund_logs").select("staff_note, refund_amount, branch_id"), scope)
      .gte("created_at", today.toISOString()),
  ])

  // Group sessions by staff
  const map: Record<string, StaffMetric> = {}
  for (const s of sessionsRes.data ?? []) {
    const name = (s.staff_name ?? "—") as string
    if (!map[name]) map[name] = { staffName: name, txCount: 0, revenue: 0, cancellations: 0 }
    map[name].txCount++
  }

  // We don't have a clean staff-id link on payments yet — leaving revenue=0 for now;
  // refunds are still counted from staff_note approximation.
  for (const r of refundsRes.data ?? []) {
    // staff_note can be the staff name (best-effort)
    const name = (r.staff_note ?? "—") as string
    if (map[name]) map[name].cancellations++
  }

  return Object.values(map).sort((a, b) => b.txCount - a.txCount).slice(0, 8)
}

// ─── Package analytics (last 7 days) ──────────────────────────────────────────

export async function getPackageMetrics(scope?: BranchScope): Promise<PackageMetric[]> {
  const supabase = createClient()
  const since = daysAgo(6)

  const { data } = await s(
    supabase.from("sessions").select("duration_minutes, created_at, branch_id"),
    scope,
  ).gte("created_at", since.toISOString())

  const rows = data ?? []
  const buckets: Record<PackageMetric["packageType"], PackageMetric> = {
    "30dk":     { packageType: "30dk",     label: "30 Dakika",  count: 0, share: 0, revenue: 0 },
    "60dk":     { packageType: "60dk",     label: "60 Dakika",  count: 0, share: 0, revenue: 0 },
    "90dk":     { packageType: "90dk",     label: "90 Dakika",  count: 0, share: 0, revenue: 0 },
    "Serbest":  { packageType: "Serbest",  label: "Sınırsız",   count: 0, share: 0, revenue: 0 },
  }

  for (const s of rows) {
    const d = Number(s.duration_minutes)
    if (d === 0) buckets["Serbest"].count++
    else if (d <= 30) buckets["30dk"].count++
    else if (d <= 60) buckets["60dk"].count++
    else buckets["90dk"].count++
  }

  const total = rows.length || 1
  for (const k of Object.keys(buckets) as PackageMetric["packageType"][]) {
    buckets[k].share = buckets[k].count / total
  }
  return Object.values(buckets)
}

// ─── Extension / unlimited stats (last 7 days) ────────────────────────────────

export async function getExtensionMetrics(scope?: BranchScope): Promise<ExtensionMetric> {
  const supabase = createClient()
  const since = daysAgo(6)

  const [extRes, sessionsRes] = await Promise.all([
    s(supabase.from("session_extensions").select("session_id, added_minutes, branch_id"), scope)
      .gte("created_at", since.toISOString()),
    s(supabase.from("sessions").select("id, duration_minutes, branch_id"), scope)
      .gte("created_at", since.toISOString()),
  ])

  const extensions = extRes.data ?? []
  const sessions = sessionsRes.data ?? []
  const unlimitedConversions = extensions.filter((e) => e.added_minutes >= 99999).length

  const uniqueExtended = new Set(extensions.map((e) => e.session_id)).size
  const extensionRate = sessions.length ? uniqueExtended / sessions.length : 0

  return {
    totalExtensions: extensions.length,
    extensionRate,
    unlimitedConversions,
  }
}

// ─── Birthday / Organization summary ──────────────────────────────────────────
// Note: organizations + birthdays tables aren't standardized in migrations yet.
// We return a defensive placeholder shape so the UI panel never crashes;
// real data lands when the schema is finalized.

export interface EventSummary {
  todayBirthdays: number
  upcomingOrgs: { name: string; date: string; childCount: number }[]
  weeklyReservations: number
}

export async function getEventSummary(scope?: BranchScope): Promise<EventSummary> {
  // Best-effort: attempt to read an `organizations` table. Fail silent if absent.
  const supabase = createClient()
  try {
    const { data } = await s(
      supabase.from("organizations").select("name, event_date, child_count, branch_id"),
      scope,
    )
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(5)

    const orgs = (data ?? []).map((o) => ({
      name: o.name ?? "—",
      date: o.event_date as string,
      childCount: Number(o.child_count ?? 0),
    }))

    return {
      todayBirthdays: 0,
      upcomingOrgs: orgs,
      weeklyReservations: orgs.length,
    }
  } catch {
    return { todayBirthdays: 0, upcomingOrgs: [], weeklyReservations: 0 }
  }
}
