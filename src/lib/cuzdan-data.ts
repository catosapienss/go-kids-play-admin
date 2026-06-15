import type { FinTransaction, CustomerWallet, HourlyData, WeeklyData, DaySummary } from "@/types/cuzdan"

export const TODAY_TRANSACTIONS: FinTransaction[] = [
  {
    id: "tx_001", type: "payment", customerId: "cw_001", customerName: "Ahmet Yılmaz",
    amount: 350, method: "cash", status: "completed", staffName: "Selin K.",
    datetime: "2026-05-11 09:15", service: "90 dk Oyun",
  },
  {
    id: "tx_002", type: "payment", customerId: "cw_002", customerName: "Ayşe Demir",
    amount: 450, method: "card", status: "completed", staffName: "Selin K.",
    datetime: "2026-05-11 09:47", service: "2 Saat Oyun",
  },
  {
    id: "tx_003", type: "payment", customerId: "cw_003", customerName: "Fatma Kaya",
    amount: 550, method: "split", status: "completed", staffName: "Emre T.",
    datetime: "2026-05-11 10:22", service: "2 Saat Oyun + Atıştırmalık",
    split: { card: 350, wallet: 200 },
  },
  {
    id: "tx_004", type: "wallet_load", customerId: "cw_004", customerName: "Mehmet Çelik",
    amount: 500, method: "card", status: "completed", staffName: "Emre T.",
    datetime: "2026-05-11 10:38", service: "Cüzdan Yükleme",
    note: "₺50 bonus eklendi",
  },
  {
    id: "tx_005", type: "payment", customerId: "cw_005", customerName: "Zeynep Arslan",
    amount: 200, method: "cash", status: "completed", staffName: "Selin K.",
    datetime: "2026-05-11 11:05", service: "1 Saat Oyun",
  },
  {
    id: "tx_006", type: "payment", customerId: "cw_001", customerName: "Can Özkan",
    amount: 400, method: "split", status: "completed", staffName: "Emre T.",
    datetime: "2026-05-11 11:33", service: "90 dk Oyun × 2",
    split: { cash: 200, card: 200 },
  },
  {
    id: "tx_007", type: "wallet_use", customerId: "cw_002", customerName: "Ayşe Demir",
    amount: 150, method: "wallet", status: "completed", staffName: "Selin K.",
    datetime: "2026-05-11 12:01", service: "Atıştırmalık & İçecek",
  },
  {
    id: "tx_008", type: "payment", customerId: "cw_006", customerName: "Hasan Kara",
    amount: 300, method: "cash", status: "completed", staffName: "Emre T.",
    datetime: "2026-05-11 12:28", service: "90 dk Oyun",
  },
  {
    id: "tx_009", type: "refund", customerId: "cw_003", customerName: "Fatma Kaya",
    amount: 550, method: "wallet", status: "completed", staffName: "Emre T.",
    datetime: "2026-05-11 12:44", service: "İptal — tx_003",
    refundOf: "tx_003", cancelReason: "Çocuk hastalandı",
    note: "Cüzdana aktarıldı",
  },
  {
    id: "tx_010", type: "payment", customerId: "cw_007", customerName: "Leyla Şahin",
    amount: 550, method: "card", status: "completed", staffName: "Selin K.",
    datetime: "2026-05-11 13:05", service: "2 Saat Oyun + Pasta Servisi",
  },
  {
    id: "tx_011", type: "wallet_load", customerId: "cw_002", customerName: "Ayşe Demir",
    amount: 1000, method: "card", status: "completed", staffName: "Selin K.",
    datetime: "2026-05-11 13:32", service: "Cüzdan Yükleme",
    note: "₺100 bonus kampanyası",
  },
  {
    id: "tx_012", type: "bonus", customerId: "cw_002", customerName: "Ayşe Demir",
    amount: 100, method: "wallet", status: "completed", staffName: "Sistem",
    datetime: "2026-05-11 13:32", service: "Yükleme Bonusu",
  },
  {
    id: "tx_013", type: "payment", customerId: "cw_008", customerName: "Mustafa Yıldız",
    amount: 250, method: "cash", status: "completed", staffName: "Emre T.",
    datetime: "2026-05-11 14:00", service: "1 Saat Oyun",
  },
  {
    id: "tx_014", type: "payment", customerId: "cw_009", customerName: "Elif Doğan",
    amount: 550, method: "split", status: "completed", staffName: "Selin K.",
    datetime: "2026-05-11 14:33", service: "2 Saat Oyun × 2",
    split: { cash: 400, wallet: 150 },
  },
  {
    id: "tx_015", type: "payment", customerId: "cw_010", customerName: "Serkan Aktaş",
    amount: 450, method: "card", status: "completed", staffName: "Emre T.",
    datetime: "2026-05-11 15:10", service: "2 Saat Oyun",
  },
  {
    id: "tx_016", type: "payment", customerId: "cw_011", customerName: "Büşra Çetin",
    amount: 200, method: "cash", status: "completed", staffName: "Selin K.",
    datetime: "2026-05-11 15:38", service: "1 Saat Oyun",
  },
  {
    id: "tx_017", type: "wallet_use", customerId: "cw_004", customerName: "Mehmet Çelik",
    amount: 250, method: "wallet", status: "completed", staffName: "Emre T.",
    datetime: "2026-05-11 16:02", service: "90 dk Oyun",
  },
  {
    id: "tx_018", type: "payment", customerId: "cw_012", customerName: "Gül Yaman",
    amount: 500, method: "split", status: "completed", staffName: "Selin K.",
    datetime: "2026-05-11 16:29", service: "2 Saat Oyun × 2",
    split: { cash: 300, card: 200 },
  },
  {
    id: "tx_019", type: "refund", customerId: "cw_001", customerName: "Can Özkan",
    amount: 100, method: "wallet", status: "completed", staffName: "Emre T.",
    datetime: "2026-05-11 17:03", service: "Kısmi İade — tx_006",
    refundOf: "tx_006", cancelReason: "Fazla süre ücreti",
    note: "Cüzdana aktarıldı",
  },
  {
    id: "tx_020", type: "payment", customerId: "cw_013", customerName: "Onur Başar",
    amount: 350, method: "cash", status: "completed", staffName: "Selin K.",
    datetime: "2026-05-11 17:35", service: "90 dk Oyun",
  },
  {
    id: "tx_021", type: "payment", customerId: "cw_014", customerName: "Selin Koç",
    amount: 600, method: "card", status: "completed", staffName: "Emre T.",
    datetime: "2026-05-11 18:05", service: "3 Saat Oyun + Pasta",
  },
]

export const CUSTOMER_WALLETS: CustomerWallet[] = [
  {
    id: "cw_002",
    name: "Ayşe Demir",
    phone: "0532 111 22 33",
    balance: 1100,
    bonusBalance: 100,
    totalLoaded: 1200,
    totalUsed: 200,
    lastActivity: "2026-05-11 13:32",
    transactions: [
      { id: "wt_001", type: "load", amount: 200, datetime: "2026-04-15 11:00", staffName: "Selin K.", note: "İlk yükleme" },
      { id: "wt_002", type: "use", amount: 150, datetime: "2026-05-11 12:01", staffName: "Selin K.", note: "Atıştırmalık" },
      { id: "wt_003", type: "load", amount: 1000, datetime: "2026-05-11 13:32", staffName: "Selin K." },
      { id: "wt_004", type: "bonus", amount: 100, datetime: "2026-05-11 13:32", staffName: "Sistem", note: "Yükleme Kampanyası" },
    ],
  },
  {
    id: "cw_004",
    name: "Mehmet Çelik",
    phone: "0541 333 44 55",
    balance: 300,
    bonusBalance: 50,
    totalLoaded: 600,
    totalUsed: 350,
    lastActivity: "2026-05-11 16:02",
    transactions: [
      { id: "wt_005", type: "load", amount: 600, datetime: "2026-05-11 10:38", staffName: "Emre T.", note: "₺50 bonus eklendi" },
      { id: "wt_006", type: "bonus", amount: 50, datetime: "2026-05-11 10:38", staffName: "Sistem" },
      { id: "wt_007", type: "use", amount: 250, datetime: "2026-05-11 16:02", staffName: "Emre T.", note: "90 dk Oyun" },
      { id: "wt_008", type: "use", amount: 100, datetime: "2026-04-28 14:30", staffName: "Selin K." },
    ],
  },
  {
    id: "cw_003",
    name: "Fatma Kaya",
    phone: "0555 567 89 01",
    balance: 550,
    bonusBalance: 0,
    totalLoaded: 550,
    totalUsed: 0,
    lastActivity: "2026-05-11 12:44",
    transactions: [
      { id: "wt_009", type: "refund", amount: 550, datetime: "2026-05-11 12:44", staffName: "Emre T.", note: "tx_003 iadesi" },
    ],
  },
  {
    id: "cw_001",
    name: "Can Özkan",
    phone: "0533 789 01 23",
    balance: 100,
    bonusBalance: 0,
    totalLoaded: 100,
    totalUsed: 0,
    lastActivity: "2026-05-11 17:03",
    transactions: [
      { id: "wt_010", type: "refund", amount: 100, datetime: "2026-05-11 17:03", staffName: "Emre T.", note: "tx_006 kısmi iade" },
    ],
  },
  {
    id: "cw_007",
    name: "Leyla Şahin",
    phone: "0544 234 56 78",
    balance: 250,
    bonusBalance: 25,
    totalLoaded: 500,
    totalUsed: 275,
    lastActivity: "2026-05-08 16:00",
    transactions: [
      { id: "wt_011", type: "load", amount: 500, datetime: "2026-04-20 10:00", staffName: "Selin K." },
      { id: "wt_012", type: "bonus", amount: 25, datetime: "2026-04-20 10:00", staffName: "Sistem", note: "Hoşgeldin Bonusu" },
      { id: "wt_013", type: "use", amount: 275, datetime: "2026-05-08 16:00", staffName: "Emre T." },
    ],
  },
]

export const HOURLY_DATA: HourlyData[] = [
  { hour: "09:00", cash: 350, card: 450, wallet: 0 },
  { hour: "10:00", cash: 0, card: 350, wallet: 200 },
  { hour: "11:00", cash: 400, card: 0, wallet: 150 },
  { hour: "12:00", cash: 300, card: 0, wallet: 0 },
  { hour: "13:00", cash: 0, card: 1550, wallet: 0 },
  { hour: "14:00", cash: 650, card: 0, wallet: 150 },
  { hour: "15:00", cash: 200, card: 450, wallet: 0 },
  { hour: "16:00", cash: 300, card: 200, wallet: 250 },
  { hour: "17:00", cash: 350, card: 0, wallet: 0 },
  { hour: "18:00", cash: 0, card: 600, wallet: 0 },
]

export const WEEKLY_DATA: WeeklyData[] = [
  { day: "Pts", revenue: 3200 },
  { day: "Sal", revenue: 2850 },
  { day: "Çar", revenue: 4100 },
  { day: "Per", revenue: 3650 },
  { day: "Cum", revenue: 5200 },
  { day: "Cmt", revenue: 6800 },
  { day: "Paz", revenue: 4750 },
]

export const TODAY_SUMMARY: DaySummary = {
  date: "2026-05-11",
  totalCash: 1800,
  totalCard: 2800,
  totalWallet: 750,
  totalRefund: 650,
  splitPaymentCount: 4,
  txCount: 21,
  walletLoadAmount: 1500,
  netRevenue: 4700,
  avgTxAmount: 342,
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
