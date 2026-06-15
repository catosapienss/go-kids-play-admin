export type TxType = "payment" | "wallet_load" | "wallet_use" | "refund" | "bonus"
export type FinPaymentMethod = "cash" | "card" | "wallet" | "split"
export type TxStatus = "completed" | "cancelled" | "pending"

export interface SplitDetail {
  cash?: number
  card?: number
  wallet?: number
}

export interface FinTransaction {
  id: string
  type: TxType
  customerId: string
  customerName: string
  amount: number
  method: FinPaymentMethod
  split?: SplitDetail
  status: TxStatus
  staffName: string
  datetime: string
  note?: string
  refundOf?: string
  cancelReason?: string
  service: string
}

export interface WalletTx {
  id: string
  type: "load" | "use" | "bonus" | "refund"
  amount: number
  datetime: string
  note?: string
  staffName: string
}

export interface CustomerWallet {
  id: string
  name: string
  phone: string
  balance: number
  bonusBalance: number
  totalLoaded: number
  totalUsed: number
  lastActivity: string
  transactions: WalletTx[]
}

export interface HourlyData {
  hour: string
  cash: number
  card: number
  wallet: number
}

export interface WeeklyData {
  day: string
  revenue: number
}

export interface DaySummary {
  date: string
  totalCash: number
  totalCard: number
  totalWallet: number
  totalRefund: number
  splitPaymentCount: number
  txCount: number
  walletLoadAmount: number
  netRevenue: number
  avgTxAmount: number
}
