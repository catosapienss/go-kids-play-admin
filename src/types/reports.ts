// ─── Reports types ───────────────────────────────────────────────────────────

// A closed-open time range (`from <= t < to`).
export interface DateRange {
  from: Date
  to:   Date
}

// ─── Preset windows ──────────────────────────────────────────────────────────

export type RangePreset =
  | "today" | "yesterday"
  | "last7" | "last30"
  | "thisMonth" | "lastMonth"
  | "thisYear"
  | "custom"

export const PRESET_LABEL: Record<RangePreset, string> = {
  today:     "Bugün",
  yesterday: "Dün",
  last7:     "Son 7 gün",
  last30:    "Son 30 gün",
  thisMonth: "Bu ay",
  lastMonth: "Geçen ay",
  thisYear:  "Bu yıl",
  custom:    "Özel",
}

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + 1); return x
}

export function resolvePreset(preset: RangePreset, custom?: DateRange): DateRange {
  const today = startOfDay(new Date())
  switch (preset) {
    case "today":     return { from: today, to: endOfDay(today) }
    case "yesterday": {
      const y = new Date(today); y.setDate(today.getDate() - 1)
      return { from: y, to: today }
    }
    case "last7": {
      const f = new Date(today); f.setDate(today.getDate() - 6)
      return { from: f, to: endOfDay(today) }
    }
    case "last30": {
      const f = new Date(today); f.setDate(today.getDate() - 29)
      return { from: f, to: endOfDay(today) }
    }
    case "thisMonth": {
      const f = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: f, to: endOfDay(today) }
    }
    case "lastMonth": {
      const f = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const t = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: f, to: t }
    }
    case "thisYear": {
      const f = new Date(today.getFullYear(), 0, 1)
      return { from: f, to: endOfDay(today) }
    }
    case "custom":
      return custom ?? { from: today, to: endOfDay(today) }
  }
}

export function fmtRange(r: DateRange): string {
  const sameDay = r.from.toDateString() === new Date(r.to.getTime() - 1).toDateString()
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }
  if (sameDay) return r.from.toLocaleDateString("tr-TR", opts)
  const endDisplay = new Date(r.to.getTime() - 1)
  return `${r.from.toLocaleDateString("tr-TR", opts)} – ${endDisplay.toLocaleDateString("tr-TR", opts)}`
}

// ─── Revenue periods (from get_revenue_periods RPC) ──────────────────────────

export interface PeriodTotal {
  gross: number
  net: number
  cash: number
  card: number
  wallet: number
  txCount: number
  refunded: number
  sessionCount: number
}

export interface RevenuePeriods {
  today:     PeriodTotal
  yesterday: PeriodTotal
  week:      PeriodTotal
  prevWeek:  PeriodTotal
  month:     PeriodTotal
  prevMonth: PeriodTotal
  year:      PeriodTotal
}

interface RawPeriodTotal {
  gross: number | string
  net: number | string
  cash: number | string
  card: number | string
  wallet: number | string
  tx_count: number | string
  refunded: number | string
  session_count: number | string
}

function num(v: unknown): number {
  if (v == null) return 0
  return typeof v === "number" ? v : Number(v) || 0
}

export function normalizePeriod(r: RawPeriodTotal | undefined): PeriodTotal {
  return {
    gross:        num(r?.gross),
    net:          num(r?.net),
    cash:         num(r?.cash),
    card:         num(r?.card),
    wallet:       num(r?.wallet),
    txCount:      num(r?.tx_count),
    refunded:     num(r?.refunded),
    sessionCount: num(r?.session_count),
  }
}

export interface RawRevenuePeriods {
  today: RawPeriodTotal
  yesterday: RawPeriodTotal
  week: RawPeriodTotal
  prev_week: RawPeriodTotal
  month: RawPeriodTotal
  prev_month: RawPeriodTotal
  year: RawPeriodTotal
}

export function normalizeRevenuePeriods(r: RawRevenuePeriods): RevenuePeriods {
  return {
    today:     normalizePeriod(r.today),
    yesterday: normalizePeriod(r.yesterday),
    week:      normalizePeriod(r.week),
    prevWeek:  normalizePeriod(r.prev_week),
    month:     normalizePeriod(r.month),
    prevMonth: normalizePeriod(r.prev_month),
    year:      normalizePeriod(r.year),
  }
}

export function deltaPct(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null
  return Math.round(((current - prior) / prior) * 1000) / 10
}

// ─── Revenue breakdown (per-day) ─────────────────────────────────────────────

export interface RevenueDayPoint {
  date: string         // "12 May" formatted for chart
  iso:  string         // ISO date for keying
  cash: number
  card: number
  wallet: number
  gross: number
  refunds: number
  net: number
  txCount: number
}

export interface DbRevenueDayRow {
  day_date: string
  cash: number | string
  card: number | string
  wallet: number | string
  gross: number | string
  refunds: number | string
  net: number | string
  tx_count: number | string
}

export function dbRowToRevenueDay(r: DbRevenueDayRow): RevenueDayPoint {
  const d = new Date(r.day_date)
  return {
    date: d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
    iso: r.day_date,
    cash:    num(r.cash),
    card:    num(r.card),
    wallet:  num(r.wallet),
    gross:   num(r.gross),
    refunds: num(r.refunds),
    net:     num(r.net),
    txCount: num(r.tx_count),
  }
}

// ─── Peak hours heatmap ──────────────────────────────────────────────────────

export interface PeakHourCell {
  weekday: number   // 0..6 (Sunday=0)
  hour:    number   // 0..23
  count:   number
}

export interface DbPeakHourRow {
  weekday: number | string
  hour:    number | string
  count:   number | string
}

export function dbRowToPeakHour(r: DbPeakHourRow): PeakHourCell {
  return {
    weekday: Number(r.weekday) || 0,
    hour:    Number(r.hour) || 0,
    count:   Number(r.count) || 0,
  }
}

// ─── Customer insights ───────────────────────────────────────────────────────

export interface TopSpender {
  parentId: string
  fullName: string
  phone: string
  visits: number
  spent: number
  isVip: boolean
}

export interface CustomerInsights {
  totalCustomers: number
  activeInRange:  number
  returning:      number
  returningRate:  number
  vipCount:       number
  vipRatio:       number
  avgSpend:       number
  totalVisits:    number
  topSpenders:    TopSpender[]
}

interface RawTopSpender {
  parent_id: string
  full_name: string
  phone: string
  visits: number | string
  spent: number | string
  is_vip: boolean
}

interface RawCustomerInsights {
  total_customers: number | string
  active_in_range: number | string
  returning: number | string
  returning_rate: number | string
  vip_count: number | string
  vip_ratio: number | string
  avg_spend: number | string
  total_visits: number | string
  top_spenders: RawTopSpender[]
}

export function normalizeInsights(r: RawCustomerInsights): CustomerInsights {
  return {
    totalCustomers: num(r.total_customers),
    activeInRange:  num(r.active_in_range),
    returning:      num(r.returning),
    returningRate:  num(r.returning_rate),
    vipCount:       num(r.vip_count),
    vipRatio:       num(r.vip_ratio),
    avgSpend:       num(r.avg_spend),
    totalVisits:    num(r.total_visits),
    topSpenders:    (r.top_spenders ?? []).map((t) => ({
      parentId: t.parent_id,
      fullName: t.full_name,
      phone:    t.phone,
      visits:   num(t.visits),
      spent:    num(t.spent),
      isVip:    !!t.is_vip,
    })),
  }
}

// ─── Organization analytics ──────────────────────────────────────────────────

export interface OrgBusyDay { date: string; count: number }

export interface OrgAnalytics {
  count:       number
  avgChildren: number
  revenue:     number
  upcoming:    number
  busyDays:    OrgBusyDay[]
}

interface RawOrgAnalytics {
  count: number | string
  avg_children: number | string
  revenue: number | string
  upcoming: number | string
  busy_days: OrgBusyDay[]
}

export function normalizeOrgAnalytics(r: RawOrgAnalytics): OrgAnalytics {
  return {
    count:       num(r.count),
    avgChildren: num(r.avg_children),
    revenue:     num(r.revenue),
    upcoming:    num(r.upcoming),
    busyDays:    r.busy_days ?? [],
  }
}

// ─── Package performance ──────────────────────────────────────────────────────

export interface PackageBucket { bucket: string; count: number }

export interface PackagePerformance {
  buckets:        PackageBucket[]
  unlimitedShare: number
  extensionRate:  number
  avgDuration:    number
}

interface RawPackagePerformance {
  buckets: PackageBucket[]
  unlimited_share: number | string
  extension_rate: number | string
  avg_duration: number | string
}

export function normalizePackagePerformance(r: RawPackagePerformance): PackagePerformance {
  return {
    buckets:        r.buckets ?? [],
    unlimitedShare: num(r.unlimited_share),
    extensionRate:  num(r.extension_rate),
    avgDuration:    num(r.avg_duration),
  }
}

// ─── Staff performance ────────────────────────────────────────────────────────

export interface StaffPerformanceRow {
  staffName:     string
  sessionCount:  number
  refundCount:   number
  activeSeconds: number
  refundRate:    number
}

export interface DbStaffPerfRow {
  staff_name: string
  session_count: number | string
  refund_count: number | string
  active_seconds: number | string
  refund_rate: number | string
}

export function dbRowToStaffPerf(r: DbStaffPerfRow): StaffPerformanceRow {
  return {
    staffName:     r.staff_name,
    sessionCount:  num(r.session_count),
    refundCount:   num(r.refund_count),
    activeSeconds: num(r.active_seconds),
    refundRate:    num(r.refund_rate),
  }
}
