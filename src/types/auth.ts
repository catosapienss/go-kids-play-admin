export type UserRole = "super_admin" | "admin" | "manager" | "staff" | "cashier"

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Süper Admin",
  admin:       "Admin",
  manager:     "Yönetici",
  staff:       "Personel",
  cashier:     "Personel",
}

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
  admin:       "bg-violet-100  text-violet-700  dark:bg-violet-500/20  dark:text-violet-300",
  manager:     "bg-sky-100     text-sky-700     dark:bg-sky-500/20     dark:text-sky-300",
  staff:       "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  cashier:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
}

/** True if the role has manager-level access (admin panel full access). */
export function isManagerRole(role: UserRole): boolean {
  return role === "super_admin" || role === "admin" || role === "manager"
}

/** True if the role is staff-level (limited operational access). */
export function isStaffRole(role: UserRole): boolean {
  return role === "staff" || role === "cashier"
}

/**
 * Discrete permission keys that gate top-level modules. Admins can override
 * role defaults per-user from the staff management screen.
 */
export type ModuleKey =
  | "dashboard"
  | "customers"
  | "memberships"
  | "wallet"
  | "birthdays"
  | "reports"
  | "finance"
  | "staff"
  | "settings"
  | "tv"
  | "retail"

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard:   "Dashboard",
  customers:   "Müşteriler",
  memberships: "Üyelikler",
  wallet:      "Cüzdan",
  birthdays:   "Doğum Günleri",
  reports:     "Raporlar",
  finance:     "Finans",
  staff:       "Personel",
  settings:    "Ayarlar",
  tv:          "TV / Canlı Ekran",
  retail:      "Perakende Satış",
}

/**
 * Per-user permission overrides. `true` grants, `false` revokes, absent means
 * "use the role default". Stored in profiles.permissions as JSONB.
 */
export type PermissionOverrides = Partial<Record<ModuleKey, boolean>>

export interface UserProfile {
  id: string
  email: string
  fullName: string
  phone?: string
  role: UserRole
  isActive: boolean
  /** Null when the user is a super_admin (cross-branch). */
  branchId?: string | null
  /** Per-user grant/revoke overrides on top of the role defaults. */
  permissions?: PermissionOverrides
  username?: string | null
  lastLoginAt?: string | null
  disabled?: boolean
}

/** Helper: super admins are not bound to a single branch. */
export function isSuperAdmin(role: UserRole): boolean {
  return role === "super_admin"
}

/** Helper: can this role see/switch all branches? */
export function canSwitchBranch(role: UserRole): boolean {
  return role === "super_admin"
}
