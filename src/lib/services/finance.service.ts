import { createClient } from "@/lib/supabase/client"
import { computeBonus } from "@/types/finance"
import { safeFinanceAction } from "@/lib/reliability/idempotency"
import { recordAudit } from "@/lib/reliability/audit-log"
import { withRetry } from "@/lib/reliability/retry"
import type {
  DbWalletTransaction,
  DbSessionExtension,
  DbRefundLog,
  WalletLoadInput,
  SessionExtensionInput,
  CancelRefundInput,
  WalletSummary,
} from "@/types/finance"

// ─── Wallet Load ──────────────────────────────────────────────────────────────
//
// Hardened: action-locked + idempotent + audited.  A duplicate click within
// the same session will be coalesced into a single RPC call; a retry after a
// network blip will replay the original result instead of charging twice.

export async function loadWallet(input: WalletLoadInput): Promise<void> {
  await safeFinanceAction(
    `wallet.load:${input.parentId}:${input.amount}:${input.method}`,
    "wallet.load",
    async () => {
      const supabase = createClient()
      const bonus = computeBonus(input.amount)

      await withRetry(async () => {
        const r = await supabase.rpc("load_wallet_balance", {
          p_parent_id:   input.parentId,
          p_amount:      input.amount,
          p_bonus:       bonus,
          p_description: input.description || `Cüzdan yüklemesi (${input.method === "cash" ? "Nakit" : "Kart"})`,
          p_method:      input.method,
          p_created_by:  input.createdBy ?? null,
        })
        if (r.error) throw r.error
      }, { label: "loadWallet" })

      void recordAudit({
        action: "wallet.load",
        entityType: "parent",
        entityId: input.parentId,
        meta: { amount: input.amount, bonus, method: input.method },
      })
    },
  )
}

// ─── Wallet Balance ───────────────────────────────────────────────────────────

export async function getWalletBalance(parentId: string): Promise<number> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("parents")
    .select("wallet_balance")
    .eq("id", parentId)
    .single()

  if (error) throw error
  return Number(data?.wallet_balance ?? 0)
}

// ─── Wallet Transactions ─────────────────────────────────────────────────────

export async function getWalletTransactions(parentId: string, limit = 20): Promise<DbWalletTransaction[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as DbWalletTransaction[]
}

// ─── All Wallets ──────────────────────────────────────────────────────────────

export async function getAllWalletSummaries(): Promise<WalletSummary[]> {
  const supabase = createClient()

  // Fetch all parents (including those with 0 balance — they may have history)
  const { data: parents, error } = await supabase
    .from("parents")
    .select("id, full_name, phone, wallet_balance")
    .order("wallet_balance", { ascending: false })
    .limit(50)

  if (error) throw error

  // Fetch recent transactions for each parent in one query
  const parentIds = (parents ?? []).map((p) => p.id)
  if (parentIds.length === 0) return []

  const { data: txs, error: txErr } = await supabase
    .from("wallet_transactions")
    .select("*")
    .in("parent_id", parentIds)
    .order("created_at", { ascending: false })
    .limit(200)

  if (txErr) throw txErr

  const txsByParent: Record<string, DbWalletTransaction[]> = {}
  ;(txs ?? []).forEach((tx) => {
    if (!txsByParent[tx.parent_id]) txsByParent[tx.parent_id] = []
    txsByParent[tx.parent_id].push(tx as DbWalletTransaction)
  })

  return (parents ?? []).map((p) => ({
    parentId: p.id,
    parentName: p.full_name,
    phone: p.phone,
    balance: Number(p.wallet_balance),
    recentTransactions: (txsByParent[p.id] ?? []).slice(0, 10),
  }))
}

// ─── Session Extension ────────────────────────────────────────────────────────

/**
 * After the extension RPC succeeds, mirror the cash/card amount into the
 * `payments` table so it lands in the same reporting pipeline as ordinary
 * Quick Register sales (daily revenue, end-of-day reconciliation, ciro).
 *
 * Wallet payments are NOT mirrored — the extension RPC already deducts the
 * parent's wallet AND writes a wallet_transactions row. Counting that money
 * a second time in `payments` would inflate revenue.
 *
 * "free" payments (comped extensions) write nothing — there is no revenue
 * to mirror.
 */
async function mirrorExtensionPayment(input: SessionExtensionInput): Promise<void> {
  if (!input.paymentAmount || input.paymentAmount <= 0)             return
  if (input.paymentType === "wallet" || input.paymentType === "free") return

  const cash = input.paymentType === "cash" ? input.paymentAmount : 0
  const card = input.paymentType === "card" ? input.paymentAmount : 0
  if (cash === 0 && card === 0) return

  const supabase = createClient()
  // Best-effort: an error here must not roll back the extension itself,
  // which has already been committed by the RPC.
  const { error } = await supabase.from("payments").insert({
    session_id:    input.sessionId,
    cash_amount:   cash,
    card_amount:   card,
    wallet_amount: 0,
    total_amount:  input.paymentAmount,
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[finance] extension payment mirror failed", error.message)
  }
}

export async function extendSessionWithPayment(input: SessionExtensionInput): Promise<void> {
  await safeFinanceAction(
    `session.extend:${input.sessionId}:${input.minutes}`,
    "session.extend",
    async () => {
      const supabase = createClient()
      const { error } = await supabase.rpc("extend_session_with_payment", {
        p_session_id:    input.sessionId,
        p_minutes:       input.minutes,
        p_payment_amount: input.paymentAmount,
        p_payment_type:  input.paymentType,
        p_created_by:    input.createdBy ?? null,
      })
      if (error) throw error
      // Mirror to payments so the extension shows up in revenue/end-of-day.
      await mirrorExtensionPayment(input)
      void recordAudit({
        action: "session.extend",
        entityType: "session",
        entityId: input.sessionId,
        meta: { minutes: input.minutes, amount: input.paymentAmount, method: input.paymentType, kind: "session_extension" },
      })
    },
  )
}

export async function convertToUnlimited(input: SessionExtensionInput): Promise<void> {
  await safeFinanceAction(
    `session.convertUnlimited:${input.sessionId}`,
    "session.convert_unlimited",
    async () => {
      const supabase = createClient()
      const { error } = await supabase.rpc("convert_to_unlimited", {
        p_session_id:     input.sessionId,
        p_payment_amount: input.paymentAmount,
        p_payment_type:   input.paymentType,
        p_created_by:     input.createdBy ?? null,
      })
      if (error) throw error
      await mirrorExtensionPayment(input)
      void recordAudit({
        action: "session.convert_unlimited",
        entityType: "session",
        entityId: input.sessionId,
        meta: { amount: input.paymentAmount, method: input.paymentType, kind: "session_extension" },
      })
    },
  )
}

export async function getSessionExtensions(sessionId: string): Promise<DbSessionExtension[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("session_extensions")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as DbSessionExtension[]
}

// ─── Cancel & Refund ──────────────────────────────────────────────────────────

export async function cancelAndRefund(input: CancelRefundInput): Promise<number> {
  return safeFinanceAction(
    // One-refund-per-session lock — even if the operator double-clicks across
    // tabs or the network flakes, only one refund ever lands in the database.
    `refund:${input.sessionId}`,
    "refund.cancel",
    async () => {
      const supabase = createClient()

      const { data, error } = await supabase.rpc("cancel_and_refund", {
        p_session_id:  input.sessionId,
        p_reason:      input.reason,
        p_note:        input.note || null,
        p_refunded_by: input.refundedBy ?? null,
      })

      if (error) throw error
      const amount = Number(data ?? 0)
      void recordAudit({
        action: "refund.cancel",
        severity: "warning",
        entityType: "session",
        entityId: input.sessionId,
        meta: { amount, reason: input.reason, note: input.note ?? null },
      })
      return amount
    },
  )
}

export async function getRefundLogs(sessionId: string): Promise<DbRefundLog[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("refund_logs")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as DbRefundLog[]
}

// ─── Today's finance summary ─────────────────────────────────────────────────

export async function getTodayFinanceSummary() {
  const supabase = createClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [paymentsRes, walletsRes, refundsRes, retailRes] = await Promise.all([
    supabase
      .from("payments")
      .select("cash_amount, card_amount, wallet_amount, total_amount")
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("wallet_transactions")
      .select("type, amount, method")
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("refund_logs")
      .select("refund_amount")
      .gte("created_at", todayStart.toISOString()),
    // Retail tenders the same drawer / POS terminal — must be part of the
    // cash & card totals or the day-end will never reconcile to the terminal.
    supabase
      .from("retail_sales")
      .select("cash_amount, card_amount, total_amount, voided")
      .gte("sold_at", todayStart.toISOString()),
  ])

  const payments = paymentsRes.data ?? []
  const walletTxs = walletsRes.data ?? []
  const refunds = refundsRes.data ?? []
  const retail = (retailRes.data ?? []).filter((r) => !(r as { voided?: boolean }).voided)

  const retailCash = retail.reduce((s, r) => s + Number((r as { cash_amount?: number }).cash_amount ?? 0), 0)
  const retailCard = retail.reduce((s, r) => s + Number((r as { card_amount?: number }).card_amount ?? 0), 0)
  const retailRevenue = retail.reduce((s, r) => s + Number((r as { total_amount?: number }).total_amount ?? 0), 0)

  const totalCash   = payments.reduce((s, p) => s + Number(p.cash_amount), 0) + retailCash
  const totalCard   = payments.reduce((s, p) => s + Number(p.card_amount), 0) + retailCard
  const totalWallet = payments.reduce((s, p) => s + Number(p.wallet_amount), 0)
  const totalRevenue = payments.reduce((s, p) => s + Number(p.total_amount), 0) + retailRevenue

  const loads = walletTxs.filter((t) => t.type === "load")
  const walletLoaded     = loads.reduce((s, t) => s + Number(t.amount), 0)
  const walletCardLoaded = loads.filter((t) => t.method === "card").reduce((s, t) => s + Number(t.amount), 0)
  const walletCashLoaded = loads.filter((t) => t.method === "cash").reduce((s, t) => s + Number(t.amount), 0)
  const totalRefunded = refunds.reduce((s, r) => s + Number(r.refund_amount), 0)

  return {
    totalCash,
    totalCard,
    totalWallet,
    totalRevenue,
    walletLoaded,
    walletCardLoaded,
    walletCashLoaded,
    retailCash,
    retailCard,
    retailRevenue,
    cardTendered: totalCard + walletCardLoaded,
    cashTendered: totalCash + walletCashLoaded,
    totalRefunded,
    txCount: payments.length + retail.length,
    netRevenue: totalRevenue - totalRefunded,
  }
}
