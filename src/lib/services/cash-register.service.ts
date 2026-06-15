import { createClient } from "@/lib/supabase/client"
import { safeFinanceAction } from "@/lib/reliability/idempotency"
import { recordAudit } from "@/lib/reliability/audit-log"
import { createLogger } from "@/lib/reliability/logger"
import { toAppError, AppError } from "@/lib/reliability/errors"
import {
  dbRowToRegister,
  type CashRegister,
  type DbCashRegisterRow,
  type ExpectedTotals,
  type CloseRegisterInput,
} from "@/types/cash-register"

const log = createLogger("cash-register")

// ─── Open register (idempotent) ──────────────────────────────────────────────

export async function openCashRegister(): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("open_cash_register")
  if (error) throw error
  return String(data)
}

// ─── Expected totals (live, computed from operational tables) ────────────────

export async function getExpectedTotals(): Promise<ExpectedTotals> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_expected_totals")
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    expectedCash:     Number(row?.expected_cash     ?? 0),
    expectedCard:     Number(row?.expected_card     ?? 0),
    expectedWallet:   Number(row?.expected_wallet   ?? 0),
    expectedTotal:    Number(row?.expected_total    ?? 0),
    refundTotal:      Number(row?.refund_total      ?? 0),
    sessionCount:     Number(row?.session_count     ?? 0),
    transactionCount: Number(row?.transaction_count ?? 0),
  }
}

// ─── Today's register row (open or closed) ───────────────────────────────────

export async function getTodayRegister(): Promise<CashRegister | null> {
  const supabase = createClient()
  const today = new Date()
  const businessDate = today.toISOString().slice(0, 10) // YYYY-MM-DD

  const { data, error } = await supabase
    .from("cash_register_closings")
    .select("*")
    .eq("business_date", businessDate)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ? dbRowToRegister(data as DbCashRegisterRow) : null
}

// ─── Close register — hardened with idempotency + audit ──────────────────────
//
// `safeFinanceAction` guards against double-clicks AND replays after network
// flakes: the action key includes today's business_date so a second close
// from a different tab fails with "register_already_closed".

export async function closeCashRegister(input: CloseRegisterInput): Promise<CashRegister> {
  const businessDate = new Date().toISOString().slice(0, 10)

  return safeFinanceAction(
    `cash_register.close:${businessDate}`,
    "cash_register.close",
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("close_cash_register", {
        p_counted_cash:   input.countedCash,
        p_counted_card:   input.countedCard,
        p_counted_wallet: input.countedWallet,
        p_notes:          input.notes,
        p_meta:           input.meta ?? {},
      })

      if (error) {
        // Translate known PG errors into friendly AppErrors.
        const msg = error.message ?? ""
        if (msg.includes("discrepancy_requires_notes")) {
          throw new AppError({
            code: "validation",
            message: "discrepancy_requires_notes",
            userMessage: "Fark olduğunda not yazmak zorunludur.",
            retryable: false,
          })
        }
        if (msg.includes("register_already_closed")) {
          throw new AppError({
            code: "conflict",
            message: "register_already_closed",
            userMessage: "Bu gün için kasa zaten kapatılmış.",
            retryable: false,
          })
        }
        if (msg.includes("forbidden")) {
          throw new AppError({
            code: "forbidden",
            message: "cash close requires admin or manager role",
            userMessage: "Kasa kapatma için yönetici yetkisi gerekli.",
            retryable: false,
          })
        }
        throw toAppError(error)
      }

      const row = (Array.isArray(data) ? data[0] : data) as DbCashRegisterRow
      const register = dbRowToRegister(row)

      log.info("cash register closed", {
        id: register.id,
        diffCash: register.diffCash,
        diffCard: register.diffCard,
      })

      // Audit — warning-level if any discrepancy.
      const anyDiff =
        Math.abs(register.diffCash)   > 0.005 ||
        Math.abs(register.diffCard)   > 0.005 ||
        Math.abs(register.diffWallet) > 0.005

      void recordAudit({
        action:     "cash_register.close",
        severity:   anyDiff ? "warning" : "info",
        entityType: "cash_register",
        entityId:   register.id,
        meta: {
          businessDate: register.businessDate,
          expected: {
            cash:   register.expectedCash,
            card:   register.expectedCard,
            wallet: register.expectedWallet,
            total:  register.expectedTotal,
          },
          counted: {
            cash:   register.countedCash,
            card:   register.countedCard,
            wallet: register.countedWallet,
          },
          diff: {
            cash:   register.diffCash,
            card:   register.diffCard,
            wallet: register.diffWallet,
            total:  register.diffCash + register.diffCard + register.diffWallet,
          },
          notes: register.notes,
        },
      })

      return register
    },
  )
}

// ─── Closing history ─────────────────────────────────────────────────────────

export async function listRecentClosings(limit = 20): Promise<CashRegister[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("list_recent_closings", {
    p_limit: limit,
  })
  if (error) throw error
  return ((data ?? []) as DbCashRegisterRow[]).map(dbRowToRegister)
}
