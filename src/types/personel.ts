export type StaffRole = "admin" | "manager" | "cashier"
export type StaffStatus = "active" | "break" | "offline"

export type PermissionKey =
  | "take_payment"
  | "process_refund"
  | "cancel_session"
  | "view_reports"
  | "manage_staff"
  | "manage_organizations"
  | "manage_wallet"
  | "view_security_logs"
  | "modify_prices"
  | "export_data"

export type OpType = "payment" | "refund" | "cancel" | "checkin" | "checkout" | "org_action" | "wallet_load" | "extend"

export interface StaffOperation {
  id: string
  type: OpType
  description: string
  customerName?: string
  amount?: number
  datetime: string
}

export type SecurityEvent = "login" | "logout" | "failed_login" | "suspicious" | "permission_change"

export interface SecurityLog {
  id: string
  event: SecurityEvent
  device: string
  ip: string
  datetime: string
  note?: string
}

export type NoteType = "performance" | "operation" | "manager"

export interface StaffNote {
  id: string
  type: NoteType
  content: string
  authorName: string
  datetime: string
}

export interface DailyPerformance {
  day: string
  txCount: number
  cancelCount: number
  revenue: number
}

export interface StaffMember {
  id: string
  name: string
  phone: string
  email: string
  role: StaffRole
  status: StaffStatus
  loginTime: string
  lastActivity: string
  todayTxCount: number
  todayCancelCount: number
  todayRevenue: number
  totalCustomers: number
  avgTxMinutes: number
  cancelRate: number
  permissions: Record<PermissionKey, boolean>
  operations: StaffOperation[]
  securityLogs: SecurityLog[]
  notes: StaffNote[]
  dailyPerformance: DailyPerformance[]
}

export interface ActivityItem {
  id: string
  staffId: string
  staffName: string
  type: OpType | "login" | "logout"
  description: string
  datetime: string
}
