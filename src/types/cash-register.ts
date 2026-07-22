// ─── Cash Register Types ──────────────────────────────────────────────────────

export type RegisterStatus = "open" | "closed"

/** Raw DB row shape (snake_case). */
export interface DbCashRegisterRow {
  id: string
  branch_id: string | null
  business_date: string         // ISO date
  status: RegisterStatus

  opened_at: string
  closed_at: string | null
  closed_by: string | null
  closed_by_name: string | null

  expected_cash: number
  expected_card: number
  expected_wallet: number
  expected_total: number

  counted_cash: number
  counted_card: number
  counted_wallet: number

  // Discrepancies. Production has shipped two schema variants — migration 009
  // named these `diff_*` (generated columns), the recovery script named them
  // `*_diff` (plain columns). Both are optional here; `dbRowToRegister`
  // derives the value from counted − expected instead of trusting either.
  diff_cash?: number | null
  diff_card?: number | null
  diff_wallet?: number | null
  cash_diff?: number | null
  card_diff?: number | null
  wallet_diff?: number | null

  refund_total: number
  session_count: number
  transaction_count: number

  notes: string
  meta: Record<string, unknown>
  is_demo: boolean
}

/** Friendlier camelCase shape used everywhere outside the service layer. */
export interface CashRegister {
  id: string
  branchId: string | null
  businessDate: string
  status: RegisterStatus

  openedAt: string
  closedAt: string | null
  closedBy: string | null
  closedByName: string | null

  expectedCash: number
  expectedCard: number
  expectedWallet: number
  expectedTotal: number

  countedCash: number
  countedCard: number
  countedWallet: number

  diffCash: number
  diffCard: number
  diffWallet: number

  refundTotal: number
  sessionCount: number
  transactionCount: number

  notes: string
  meta: Record<string, unknown>
}

/** Coerce to a finite number, or `null` when the value is absent/garbage. */
function finite(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Discrepancy for one payment method.
 *
 * Derived from `counted − expected` — that is the definition, it matches BOTH
 * schema variants (009's generated column and the recovery script's computed
 * column), and it cannot go stale. The stored column is only a fallback for
 * the case where counted/expected themselves are missing.
 */
function discrepancy(counted: unknown, expected: unknown, ...stored: unknown[]): number {
  const c = finite(counted)
  const e = finite(expected)
  if (c !== null && e !== null) return c - e
  for (const s of stored) {
    const n = finite(s)
    if (n !== null) return n
  }
  return 0
}

export function dbRowToRegister(r: DbCashRegisterRow): CashRegister {
  return {
    id: r.id,
    branchId: r.branch_id,
    businessDate: r.business_date,
    status: r.status,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    closedBy: r.closed_by,
    closedByName: r.closed_by_name,
    expectedCash:   Number(r.expected_cash),
    expectedCard:   Number(r.expected_card),
    expectedWallet: Number(r.expected_wallet),
    expectedTotal:  Number(r.expected_total),
    countedCash:    Number(r.counted_cash),
    countedCard:    Number(r.counted_card),
    countedWallet:  Number(r.counted_wallet),
    diffCash:       discrepancy(r.counted_cash,   r.expected_cash,   r.diff_cash,   r.cash_diff),
    diffCard:       discrepancy(r.counted_card,   r.expected_card,   r.diff_card,   r.card_diff),
    diffWallet:     discrepancy(r.counted_wallet, r.expected_wallet, r.diff_wallet, r.wallet_diff),
    refundTotal:    Number(r.refund_total),
    sessionCount:   Number(r.session_count),
    transactionCount: Number(r.transaction_count),
    notes: r.notes ?? "",
    meta: r.meta ?? {},
  }
}

// ─── Expected totals (live aggregate from operational tables) ────────────────

export interface ExpectedTotals {
  expectedCash:     number
  expectedCard:     number
  expectedWallet:   number
  expectedTotal:    number
  refundTotal:      number
  sessionCount:     number
  transactionCount: number
}

// ─── Close input ──────────────────────────────────────────────────────────────

export interface CloseRegisterInput {
  countedCash:    number
  countedCard:    number
  countedWallet:  number
  notes:          string
  meta?:          Record<string, unknown>
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export type PaymentMethod = "cash" | "card" | "wallet"

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash:   "Nakit",
  card:   "Kart",
  wallet: "Cüzdan",
}

/** Discrepancy is "OK" when |diff| < 0.005 (sub-cent rounding noise). */
export function isReconciled(diff: number): boolean {
  return Math.abs(diff) < 0.005
}

export function totalDiscrepancy(r: Pick<CashRegister, "diffCash" | "diffCard" | "diffWallet">): number {
  return r.diffCash + r.diffCard + r.diffWallet
}
