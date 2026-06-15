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

export interface UserProfile {
  id: string
  email: string
  fullName: string
  phone?: string
  role: UserRole
  isActive: boolean
  /** Null when the user is a super_admin (cross-branch). */
  branchId?: string | null
}

/** Helper: super admins are not bound to a single branch. */
export function isSuperAdmin(role: UserRole): boolean {
  return role === "super_admin"
}

/** Helper: can this role see/switch all branches? */
export function canSwitchBranch(role: UserRole): boolean {
  return role === "super_admin"
}
