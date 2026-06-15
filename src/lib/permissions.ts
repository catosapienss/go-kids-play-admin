import type { UserRole } from "@/types/auth"

/** Routes that require a minimum role to access */
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/":              ["super_admin", "admin", "manager"],
  "/hizli-kayit":   ["super_admin", "admin", "manager", "staff", "cashier"],
  "/aktif-oyun":    ["super_admin", "admin", "manager", "staff", "cashier"],
  "/crm":           ["super_admin", "admin", "manager"],
  "/dogum-gunleri": ["super_admin", "admin", "manager"],
  "/uyelikler":     ["super_admin", "admin", "manager"],
  "/cuzdan":        ["super_admin", "admin", "manager"],
  "/raporlar":      ["super_admin", "admin", "manager"],
  "/gun-sonu":      ["super_admin", "admin", "manager", "staff", "cashier"],
  "/audit-log":     ["super_admin", "admin", "manager"],
  "/personeller":   ["super_admin", "admin"],
  "/subeler":       ["super_admin"],
  "/ayarlar":       ["super_admin", "admin"],
  "/dev-status":    ["super_admin", "admin"],
  "/durum":         ["super_admin", "admin", "manager"],
  "/yetki":         ["super_admin", "admin", "manager", "staff", "cashier"],
}

/** Public routes that never need auth */
export const PUBLIC_ROUTES = ["/login", "/tv", "/app", "/parent", "/canli"]

const PERMISSIVE_MODE = false

/** Check if a route is accessible for the given role */
export function canAccessRoute(pathname: string, role: UserRole): boolean {
  if (PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true
  if (PERMISSIVE_MODE) return true

  // Exact match
  if (ROUTE_ROLES[pathname]) return ROUTE_ROLES[pathname].includes(role)

  // Prefix match (e.g. /crm/123 → /crm)
  const base = "/" + pathname.split("/")[1]
  if (ROUTE_ROLES[base]) return ROUTE_ROLES[base].includes(role)

  // Default: admin-or-higher for unknown routes
  return role === "admin" || role === "super_admin"
}

/** Returns the first allowed route for a role (fallback redirect) */
export function defaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "super_admin":
    case "admin":
    case "manager":
      return "/"
    case "staff":
    case "cashier":
      return "/hizli-kayit"
  }
}

// ─── Branch-aware permission helpers ──────────────────────────────────────────

export interface BranchPermissionCheck {
  role: UserRole
  callerBranchId: string | null | undefined
  targetBranchId: string | null | undefined
}

export function canReadBranch(c: BranchPermissionCheck): boolean {
  if (c.role === "super_admin") return true
  if (!c.callerBranchId) return false
  return c.callerBranchId === c.targetBranchId
}

export function canWriteBranch(c: BranchPermissionCheck): boolean {
  return canReadBranch(c)
}
