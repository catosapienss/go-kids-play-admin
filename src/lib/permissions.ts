import type { ModuleKey, PermissionOverrides, UserProfile, UserRole } from "@/types/auth"

// ─── Module access (per-user overrides on top of role defaults) ──────────────
//
// Finance is restricted: admin gets it by default, manager/staff must be
// explicitly granted via the staff management screen.

export const DEFAULT_MODULE_ACCESS: Record<UserRole, Record<ModuleKey, boolean>> = {
  super_admin: {
    dashboard: true, customers: true, memberships: true, wallet: true,
    birthdays: true, reports: true, finance: true, staff: true,
    settings: true, tv: true, retail: true,
  },
  admin: {
    dashboard: true, customers: true, memberships: true, wallet: true,
    birthdays: true, reports: true, finance: true, staff: true,
    settings: true, tv: true, retail: true,
  },
  manager: {
    dashboard: true, customers: true, memberships: true, wallet: true,
    birthdays: true, reports: true, finance: false, staff: false,
    settings: false, tv: true, retail: true,
  },
  staff: {
    dashboard: false, customers: false, memberships: false, wallet: false,
    birthdays: false, reports: false, finance: false, staff: false,
    settings: false, tv: false, retail: true,
  },
  cashier: {
    dashboard: false, customers: false, memberships: false, wallet: false,
    birthdays: false, reports: false, finance: false, staff: false,
    settings: false, tv: false, retail: true,
  },
}

/** Map a route prefix to the module it belongs to (for route-level gating). */
export const ROUTE_MODULE: Record<string, ModuleKey> = {
  "/":              "dashboard",
  "/crm":           "customers",
  "/uyelikler":     "memberships",
  "/cuzdan":        "wallet",
  "/dogum-gunleri": "birthdays",
  "/raporlar":      "reports",
  "/personeller":   "staff",
  "/ayarlar":       "settings",
  "/tv":            "tv",
  "/canli":         "tv",
}

/** Resolve effective access by combining role default + per-user override. */
export function hasModuleAccess(
  user: Pick<UserProfile, "role" | "permissions"> | null | undefined,
  module: ModuleKey,
): boolean {
  if (!user) return false
  const override = user.permissions?.[module]
  if (typeof override === "boolean") return override
  return DEFAULT_MODULE_ACCESS[user.role]?.[module] ?? false
}

/** Apply overrides verbatim (used when persisting). Strips undefineds. */
export function compactOverrides(p: PermissionOverrides): PermissionOverrides {
  const out: PermissionOverrides = {}
  for (const key of Object.keys(p) as ModuleKey[]) {
    const v = p[key]
    if (typeof v === "boolean") out[key] = v
  }
  return out
}

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
