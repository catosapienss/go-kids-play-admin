import type { FinTransaction, CustomerWallet, HourlyData, WeeklyData, DaySummary } from "@/types/cuzdan"

// ─── Production stubs ────────────────────────────────────────────────────────
//
// Demo seed arrays were removed for the production deploy. The /cuzdan page
// renders empty states for these until the real Supabase-backed adapters are
// wired in (Phase 7). Charts that depend on hourly/weekly aggregates show
// "Veri yok" placeholders rather than fabricated trends.

export const TODAY_TRANSACTIONS: FinTransaction[] = []

export const CUSTOMER_WALLETS: CustomerWallet[] = []

export const HOURLY_DATA: HourlyData[] = []

export const WEEKLY_DATA: WeeklyData[] = []

export const TODAY_SUMMARY: DaySummary = {
  date: new Date().toISOString().slice(0, 10),
  totalCash: 0,
  totalCard: 0,
  totalWallet: 0,
  totalRefund: 0,
  splitPaymentCount: 0,
  txCount: 0,
  walletLoadAmount: 0,
  netRevenue: 0,
  avgTxAmount: 0,
}

export function getTxTypeLabel(type: FinTransaction["type"]): string {
  const map: Record<FinTransaction["type"], string> = {
    payment: "Ödeme",
    wallet_load: "Cüzdan Yükleme",
    wallet_use: "Cüzdan Kullanımı",
    refund: "İade",
    bonus: "Bonus",
  }
  return map[type]
}

export function getMethodLabel(method: FinTransaction["method"]): string {
  const map: Record<FinTransaction["method"], string> = {
    cash: "Nakit",
    card: "Kart",
    wallet: "Cüzdan",
    split: "Karma",
  }
  return map[method]
}
