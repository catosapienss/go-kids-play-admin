export type SegmentFilter =
  | "all"
  | "vip"
  | "frequent"
  | "inactive"
  | "new"
  | "wallet"

export type PaymentMethod = "cash" | "card" | "wallet"
export type WalletTxType = "load" | "use" | "refund" | "bonus"
export type NoteType = "general" | "allergy" | "problem" | "cancellation"

export interface ChildProfile {
  id: string
  name: string
  age: number
  totalVisits: number
  favoritePackage: string
  lastVisit: string
}

export interface Visit {
  id: string
  date: string
  childName: string
  duration: string
  packageType: string
  paymentMethod: PaymentMethod
  staffName: string
  amount: number
  notes?: string
}

export interface WalletTransaction {
  id: string
  date: string
  type: WalletTxType
  amount: number
  balance: number
  description: string
  staffName?: string
}

export interface Organization {
  id: string
  type: "birthday" | "event" | "reservation"
  title: string
  date: string
  participants: number
  amount: number
  status: "completed" | "upcoming" | "cancelled"
}

export interface StaffNote {
  id: string
  date: string
  type: NoteType
  content: string
  staffName: string
}

export interface MonthlyStats {
  month: string
  visits: number
  spend: number
}

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  memberSince: string
  totalSpend: number
  totalVisits: number
  lastVisit: string
  walletBalance: number
  isVip: boolean
  notes: string
  allergies: string
  avatarColor: string
  children: ChildProfile[]
  visits: Visit[]
  walletTransactions: WalletTransaction[]
  organizations: Organization[]
  staffNotes: StaffNote[]
  monthlyStats: MonthlyStats[]
}
