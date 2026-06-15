export type OrgStatus = "upcoming" | "ongoing" | "completed" | "cancelled"
export type PaymentStatus = "unpaid" | "deposit" | "partial" | "paid"
export type OrgPaymentMethod = "cash" | "card" | "wallet" | "transfer"
export type ChildAttendance = "expected" | "arrived" | "absent"
export type TimelineEventType =
  | "created" | "deposit" | "confirmed" | "reminder" | "started"
  | "children_arrived" | "completed" | "cancelled" | "note"

export interface OrgPackage {
  id: string
  name: string
  price: number
  childLimit: number
  durationHours: number
  color: string
  gradient: string
  includes: string[]
}

export interface OrgChild {
  id: string
  name: string
  age: number
  attendance: ChildAttendance
  isExtra: boolean
  parentName?: string
}

export interface OrgPayment {
  id: string
  date: string
  method: OrgPaymentMethod
  amount: number
  type: "deposit" | "installment" | "full" | "refund"
  staffName: string
  note?: string
}

export interface OrgTimelineEvent {
  id: string
  type: TimelineEventType
  date: string
  title: string
  description?: string
  staffName?: string
}

export interface OrgOperationLog {
  id: string
  date: string
  action: string
  staffName: string
  note?: string
}

export interface Organization {
  id: string
  name: string
  childName: string
  childAge: number
  parentName: string
  parentPhone: string
  packageId: string
  date: string
  startTime: string
  endTime: string
  status: OrgStatus
  paymentStatus: PaymentStatus
  totalAmount: number
  depositAmount: number
  paidAmount: number
  childCount: number
  extraChildCount: number
  notes: string
  specialRequests: string
  decorTheme?: string
  responsibleStaff: string
  children: OrgChild[]
  payments: OrgPayment[]
  timeline: OrgTimelineEvent[]
  operationLogs: OrgOperationLog[]
}

export const ORG_PACKAGES: OrgPackage[] = [
  {
    id: "pkg_mini",
    name: "Mini Paket",
    price: 800,
    childLimit: 10,
    durationHours: 2,
    color: "sky",
    gradient: "from-sky-500 to-blue-600",
    includes: ["Oyun alanı kullanımı", "Pasta servisi", "Balon süsleme", "Temel ikram"],
  },
  {
    id: "pkg_standard",
    name: "Standart Paket",
    price: 1200,
    childLimit: 15,
    durationHours: 3,
    color: "violet",
    gradient: "from-violet-500 to-purple-600",
    includes: ["Oyun alanı kullanımı", "Pasta + içecek", "Balon & bez süsleme", "Animatör", "Fotoğraf çekimi"],
  },
  {
    id: "pkg_premium",
    name: "Premium Paket",
    price: 1800,
    childLimit: 20,
    durationHours: 4,
    color: "emerald",
    gradient: "from-emerald-500 to-green-600",
    includes: ["Oyun alanı kullanımı", "Özel pasta", "Tema süsleme", "Animatör + DJ", "Fotoğraf + video", "VIP ikram tabağı"],
  },
  {
    id: "pkg_vip",
    name: "VIP Paket",
    price: 2500,
    childLimit: 25,
    durationHours: 5,
    color: "amber",
    gradient: "from-amber-500 to-orange-600",
    includes: ["Özel VIP salon", "Özel pasta tasarımı", "Tam tema dekorasyon", "Animatör + DJ + Sihirbaz", "Profesyonel fotoğrafçı", "Gala ikram menüsü", "Veli kokteyl alanı"],
  },
]
