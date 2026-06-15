import { createClient } from "@/lib/supabase/client"
import { toAppError, AppError } from "@/lib/reliability/errors"
import { safeFinanceAction } from "@/lib/reliability/idempotency"
import { recordAudit } from "@/lib/reliability/audit-log"
import { createLogger } from "@/lib/reliability/logger"
import {
  dbRowToReservation, findPackage, PACKAGE_CATALOG,
  type DbReservationRow, type Reservation,
  type PackageOption, type PurchaseInput,
} from "@/types/mobile-purchase"

const log = createLogger("mobile-purchase")

// ─── Catalog ─────────────────────────────────────────────────────────────────

export async function getPackageCatalog(): Promise<PackageOption[]> {
  // Hardcoded today; future swap to `supabase.from("packages").select("*")`.
  return PACKAGE_CATALOG
}

// ─── Purchase ────────────────────────────────────────────────────────────────

export async function purchasePackage(input: PurchaseInput): Promise<Reservation> {
  const pkg = findPackage(input.packageId)
  if (!pkg) {
    throw new AppError({ code: "validation", message: "package_not_found", userMessage: "Paket bulunamadı.", retryable: false })
  }

  const total = input.walletAmount + input.cardAmount + input.cashAmount
  if (Math.abs(total - pkg.price) > 0.01) {
    throw new AppError({
      code: "validation",
      message: "amount_mismatch",
      userMessage: "Ödeme tutarı paket fiyatıyla uyuşmuyor.",
      retryable: false,
    })
  }

  // Idempotency key: parent + package + amount → blocks accidental double-buys
  // within a single session. Reservations themselves are short-lived so the
  // 24h dedupe window of the key store is more than enough.
  return safeFinanceAction(
    `mobile.purchase:${input.parentId}:${input.packageId}:${pkg.price}`,
    "mobile.purchase",
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("create_mobile_reservation", {
        p_parent_id:        input.parentId,
        p_child_id:         input.childId ?? null,
        p_duration_minutes: pkg.durationMinutes,
        p_amount:           pkg.price,
        p_cash_amount:      input.cashAmount,
        p_card_amount:      input.cardAmount,
        p_wallet_amount:    input.walletAmount,
        p_provider:         input.provider,
      })
      if (error) {
        const m = error.message ?? ""
        if (m.includes("insufficient_wallet")) {
          throw new AppError({ code: "validation", message: m, userMessage: "Cüzdan bakiyesi yetersiz.", retryable: false })
        }
        if (m.includes("amounts_do_not_sum")) {
          throw new AppError({ code: "validation", message: m, userMessage: "Ödeme tutarları toplamla uyuşmuyor.", retryable: false })
        }
        throw toAppError(error)
      }

      const row = (Array.isArray(data) ? data[0] : data) as DbReservationRow
      const reservation = dbRowToReservation(row)
      log.info("mobile reservation created", {
        id: reservation.id, code: reservation.entryCode, amount: reservation.amount,
      })
      void recordAudit({
        action: "mobile.purchase.create",
        entityType: "pending_reservation",
        entityId: reservation.id,
        meta: {
          packageId:    input.packageId,
          duration:     pkg.durationMinutes,
          amount:       pkg.price,
          wallet:       input.walletAmount,
          card:         input.cardAmount,
          cash:         input.cashAmount,
          provider:     input.provider,
          childId:      input.childId,
        },
      })
      return reservation
    },
  )
}

// ─── List active / recent reservations for a parent ─────────────────────────

export async function listParentReservations(parentId: string): Promise<Reservation[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pending_reservations")
    .select("*")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw toAppError(error)
  return ((data ?? []) as DbReservationRow[]).map(dbRowToReservation)
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export async function cancelReservation(id: string, reason = "parent_cancelled"): Promise<Reservation> {
  return safeFinanceAction(
    `mobile.cancel:${id}`,
    "mobile.purchase.cancel",
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("cancel_mobile_reservation", {
        p_reservation_id: id,
        p_reason:         reason,
      })
      if (error) {
        const m = error.message ?? ""
        if (m.includes("reservation_not_pending")) {
          throw new AppError({ code: "conflict", message: m, userMessage: "Bu rezervasyon iptal edilemez.", retryable: false })
        }
        throw toAppError(error)
      }
      const row = (Array.isArray(data) ? data[0] : data) as DbReservationRow
      const reservation = dbRowToReservation(row)
      void recordAudit({
        action: "mobile.purchase.cancel",
        severity: "warning",
        entityType: "pending_reservation",
        entityId: reservation.id,
        meta: { reason, amount: reservation.amount },
      })
      return reservation
    },
  )
}

// ─── Consume (cashier-side) ──────────────────────────────────────────────────
//
// Lives in mobile-purchase service so the type signature flows from the same
// module — but it's invoked from the cashier check-in flow at the venue.

export async function consumeReservation(reservationId: string, sessionId: string): Promise<Reservation> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("consume_mobile_reservation", {
    p_reservation_id: reservationId,
    p_session_id:     sessionId,
  })
  if (error) {
    const m = error.message ?? ""
    if (m.includes("reservation_not_pending")) {
      throw new AppError({ code: "conflict", message: m, userMessage: "Bu rezervasyon kullanılamaz.", retryable: false })
    }
    throw toAppError(error)
  }
  const row = (Array.isArray(data) ? data[0] : data) as DbReservationRow
  return dbRowToReservation(row)
}

// ─── Helper: any pending reservations for a given entry code? ────────────────
//
// Used by the cashier UI to show "Pending paket: 60 dk" when looking up a code.

export async function findPendingByCode(code: string): Promise<Reservation | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pending_reservations")
    .select("*")
    .eq("entry_code", code)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw toAppError(error)
  if (!data) return null
  return dbRowToReservation(data as DbReservationRow)
}
