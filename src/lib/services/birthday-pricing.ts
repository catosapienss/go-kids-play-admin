// ─── Birthday pricing (pure, dependency-free) ────────────────────────────────
//
// The single source of truth for a birthday reservation's money breakdown.
// Kept in its own import-free module so the UI, the stored snapshot AND the
// test suite all exercise the exact same arithmetic. No React, no Supabase, no
// path aliases — importable from anywhere, including a plain Node test.

export type PackageTier = "standard" | "premium"

export interface PackageExtra {
  key: string
  label: string
  price: number
}

export interface BirthdayPackage {
  id: string
  name: string
  description: string | null
  /** Legacy single price (kept for backward-compatible readers). */
  price: number
  isActive: boolean
  sortOrder: number
  tier: PackageTier | null
  weekdayPrice: number | null
  weekendPrice: number | null
  includedAdults: number | null
  includedChildren: number | null
  includedTotal: number | null
  extraPersonPrice: number | null
  extraPersonVatPct: number | null
  includes: string[]
  extras: PackageExtra[]
  importantNotes: string | null
}

/** Turkey business day: Sat (6) / Sun (0) are weekend. Computed from the event
 *  date string (yyyy-mm-dd) at LOCAL midnight so it never drifts by timezone. */
export function isWeekendDate(isoDate: string): boolean {
  if (!isoDate) return false
  const [y, m, d] = isoDate.split("-").map(Number)
  if (!y || !m || !d) return false
  const dow = new Date(y, m - 1, d).getDay() // 0=Sun … 6=Sat, local
  return dow === 0 || dow === 6
}

/** Included capacity: premium uses `included_total`; standard the sum of
 *  adults + children (both fall back to 0 if the columns are null). */
export function includedCapacity(pkg: BirthdayPackage): number {
  if (pkg.includedTotal != null) return pkg.includedTotal
  return (pkg.includedAdults ?? 0) + (pkg.includedChildren ?? 0)
}

export interface PriceInput {
  pkg: BirthdayPackage
  isoDate: string
  adultCount: number
  childCount: number
  selectedExtraKeys: string[]
  discount: number
}

export interface PriceBreakdown {
  isWeekend: boolean
  basePrice: number
  includedCapacity: number
  totalGuests: number
  extraGuestCount: number
  extraPersonUnit: number        // price incl. VAT, per person
  extraGuestCharge: number
  extras: PackageExtra[]
  extrasTotal: number
  discount: number
  total: number
}

export function computePrice(input: PriceInput): PriceBreakdown {
  const { pkg, isoDate, adultCount, childCount, selectedExtraKeys, discount } = input
  const isWeekend = isWeekendDate(isoDate)

  // Base: weekend/weekday price, falling back to the legacy single price.
  const basePrice = isWeekend
    ? (pkg.weekendPrice ?? pkg.price)
    : (pkg.weekdayPrice ?? pkg.price)

  const capacity = includedCapacity(pkg)
  const totalGuests = Math.max(0, adultCount) + Math.max(0, childCount)
  const extraGuestCount = Math.max(0, totalGuests - capacity)

  const vat = (pkg.extraPersonVatPct ?? 0) / 100
  const extraPersonUnit = Math.round((pkg.extraPersonPrice ?? 0) * (1 + vat) * 100) / 100
  const extraGuestCharge = Math.round(extraGuestCount * extraPersonUnit * 100) / 100

  const extras = pkg.extras.filter((e) => selectedExtraKeys.includes(e.key))
  const extrasTotal = extras.reduce((s, e) => s + Number(e.price ?? 0), 0)

  const safeDiscount = Math.max(0, discount || 0)
  const total = Math.max(0, basePrice + extraGuestCharge + extrasTotal - safeDiscount)

  return {
    isWeekend, basePrice, includedCapacity: capacity, totalGuests,
    extraGuestCount, extraPersonUnit, extraGuestCharge,
    extras, extrasTotal, discount: safeDiscount, total,
  }
}
