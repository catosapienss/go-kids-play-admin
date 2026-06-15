// ─── DB Row Types ─────────────────────────────────────────────────────────────

export type WalletTxType = "load" | "use" | "refund" | "bonus"
export type PaymentMethod = "cash" | "card" | "wallet" | "free"

export interface DbWalletTransaction {
  id: string
  parent_id: string
  type: WalletTxType
  amount: number
  description: string
  method: string | null       // load method: cash|card (null for use/refund/bonus)
  session_id: string | null
  created_by: string | null
  created_at: string
}

export interface DbSessionExtension {
  id: string
  session_id: string
  added_minutes: number
  payment_amount: number
  payment_type: PaymentMethod
  created_by: string | null
  created_at: string
}

export interface DbRefundLog {
  id: string
  session_id: string
  parent_id: string | null
  refund_amount: number
  refund_reason: string
  staff_note: string | null
  refunded_by: string | null
  refund_method: string
  created_at: string
}

// ─── Input DTOs ───────────────────────────────────────────────────────────────

export interface WalletLoadInput {
  parentId: string
  amount: number           // main load amount
  bonus: number            // bonus amount (computed from tiers)
  description: string
  method: "cash" | "card"
  createdBy?: string
}

export interface SessionExtensionInput {
  sessionId: string
  minutes: number
  paymentAmount: number
  paymentType: PaymentMethod
  createdBy?: string
}

export interface CancelRefundInput {
  sessionId: string
  reason: string
  note: string
  refundedBy?: string
}

// ─── UI Models ────────────────────────────────────────────────────────────────

export interface WalletSummary {
  parentId: string
  parentName: string
  phone: string
  balance: number
  recentTransactions: DbWalletTransaction[]
}

// Bonus tier config — shared between modal and service
export const BONUS_TIERS = [
  { min: 500,  bonus: 50,  label: "₺50 bonus" },
  { min: 1000, bonus: 100, label: "₺100 bonus" },
] as const

export function computeBonus(amount: number): number {
  const tier = [...BONUS_TIERS].reverse().find((t) => amount >= t.min)
  return tier?.bonus ?? 0
}

// Extension price map — keys: 30 | 60 | 0 (0 = Sınırsız/unlimited)
export const EXTENSION_PRICES: Record<number, number> = {
  30:  100,
  60:  150,
  0:   200, // Sınırsız upgrade price
}

export const UNLIMITED_MINUTES = 0 // sentinel for "convert to unlimited"
