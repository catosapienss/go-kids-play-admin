import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Currency ────────────────────────────────────────────────────────────────
//
// Single source of truth for money display. Production is a real financial
// system — values are ALWAYS shown in full with tr-TR thousands grouping
// (₺1.850, ₺12.450, ₺54.300). Never abbreviate ("1.8K" is forbidden).
//
// Amounts are rounded to whole lira for display; callers that need kuruş pass
// `fractionDigits`.

export function formatTRY(
  n: number | null | undefined,
  opts: { fractionDigits?: number; sign?: boolean } = {},
): string {
  const value = Number(n) || 0
  const frac = opts.fractionDigits ?? 0
  const formatted = Math.abs(value).toLocaleString("tr-TR", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  })
  const prefix = value < 0 ? "-₺" : opts.sign && value > 0 ? "+₺" : "₺"
  return `${prefix}${formatted}`
}

/** Plain grouped number without the ₺ symbol (e.g. axis ticks that render a
 *  separate unit label). Still full precision — never abbreviated. */
export function formatNumberTR(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString("tr-TR")
}

// ─── Dates ───────────────────────────────────────────────────────────────────
//
// Calendar-day distance between a past timestamp and now. Both operands are
// floored to LOCAL midnight before subtracting, so the result flips exactly at
// 00:00 — a visit yesterday at 23:00 seen today at 08:00 is 1 day ago, NOT 0.
//
// Returns 0 for "today", 1 for "yesterday", … and NaN for a missing/invalid
// input. Never use elapsed-hours (`Date.now() - t) / 86400000` for "visited
// today" — that treats the last 24 hours as "today" and is wrong after midnight.

export function calendarDaysAgo(
  iso: string | number | Date | null | undefined,
  now: Date = new Date(),
): number {
  if (iso === null || iso === undefined || iso === "") return NaN
  const then = iso instanceof Date ? iso : new Date(iso)
  if (isNaN(then.getTime())) return NaN
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** True when `iso` falls on the current local calendar date. */
export function isToday(iso: string | number | Date | null | undefined): boolean {
  return calendarDaysAgo(iso) === 0
}
