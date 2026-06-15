// ─── Mobile Purchase Types ────────────────────────────────────────────────────

export type PaymentProvider = "simulated" | "wallet" | "stripe" | "iyzico" | "paytr"

export type ReservationStatus = "pending" | "consumed" | "expired" | "cancelled"

// ─── Catalog ─────────────────────────────────────────────────────────────────

export interface PackageOption {
  id:        string
  /** 0 = unlimited */
  durationMinutes: number
  /** Display name */
  name:      string
  /** Short tagline shown under the name */
  tagline:   string
  /** Price in TRY */
  price:     number
  /** Decorative tone */
  tone:      "violet" | "blue" | "indigo" | "fuchsia"
  /** Highlight ("En Popüler", "Yeni" etc) */
  badge?:    string
}

/**
 * Catalog. Hardcoded today; a future migration introduces a `packages` table
 * and this list comes from `getPackageCatalog()`.
 */
export const PACKAGE_CATALOG: PackageOption[] = [
  {
    id: "p_30",  durationMinutes: 30, name: "30 Dakika", tagline: "Hızlı ziyaret",
    price: 100, tone: "blue",
  },
  {
    id: "p_60",  durationMinutes: 60, name: "60 Dakika", tagline: "Klasik seans",
    price: 150, tone: "violet", badge: "En Popüler",
  },
  {
    id: "p_90",  durationMinutes: 90, name: "90 Dakika", tagline: "Bol vakit",
    price: 200, tone: "indigo",
  },
  {
    id: "p_inf", durationMinutes: 0,  name: "Sınırsız", tagline: "Tüm gün serbest",
    price: 250, tone: "fuchsia", badge: "Esnek",
  },
]

export function findPackage(id: string): PackageOption | undefined {
  return PACKAGE_CATALOG.find((p) => p.id === id)
}

// ─── Reservation row ──────────────────────────────────────────────────────────

export interface DbReservationRow {
  id: string
  parent_id: string
  child_id: string | null
  duration_minutes: number
  amount: number | string
  cash_amount: number | string
  card_amount: number | string
  wallet_amount: number | string
  provider: PaymentProvider
  entry_code: string | null
  status: ReservationStatus
  branch_id: string | null
  session_id: string | null
  created_at: string
  expires_at: string
  consumed_at: string | null
  cancelled_at: string | null
}

export interface Reservation {
  id: string
  parentId: string
  childId: string | null
  durationMinutes: number
  amount: number
  cashAmount: number
  cardAmount: number
  walletAmount: number
  provider: PaymentProvider
  entryCode: string | null
  status: ReservationStatus
  sessionId: string | null
  createdAt: string
  expiresAt: string
  consumedAt: string | null
  cancelledAt: string | null
}

function num(v: number | string | undefined | null): number {
  if (v == null) return 0
  return typeof v === "number" ? v : Number(v) || 0
}

export function dbRowToReservation(r: DbReservationRow): Reservation {
  return {
    id: r.id,
    parentId: r.parent_id,
    childId: r.child_id,
    durationMinutes: r.duration_minutes,
    amount:        num(r.amount),
    cashAmount:    num(r.cash_amount),
    cardAmount:    num(r.card_amount),
    walletAmount:  num(r.wallet_amount),
    provider: r.provider,
    entryCode: r.entry_code,
    status: r.status,
    sessionId: r.session_id,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    consumedAt: r.consumed_at,
    cancelledAt: r.cancelled_at,
  }
}

// ─── Purchase input shape ────────────────────────────────────────────────────

export interface PurchaseInput {
  parentId:       string
  childId:        string | null
  packageId:      string
  /** Wallet amount the parent wants to use (0 → none). */
  walletAmount:   number
  /** Card amount — simulated today. */
  cardAmount:     number
  /** Cash is allowed for future "pay-on-arrival" flow. */
  cashAmount:     number
  provider:       PaymentProvider
}
