// ─── Offline / Local Demo Mode ────────────────────────────────────────────────
//
// When the Supabase project is unreachable (paused, deleted, or operating
// without network) we still want the platform to render end-to-end for demos
// and walkthroughs. This module provides a fake "admin" user that the auth
// context can mount instead of calling Supabase.
//
// Pattern: a flag in localStorage means "I'm running locally without Supabase".
// `signOut` clears the flag so the operator can return to real auth later.

import type { UserProfile, UserRole } from "@/types/auth"

const STORAGE_KEY = "gkp:offline-mode:active"

const OFFLINE_USERS: Record<UserRole, UserProfile> = {
  super_admin: {
    id:        "offline-super-admin",
    email:     "offline@gokids.local",
    fullName:  "Süper Admin (Offline)",
    role:      "super_admin",
    isActive:  true,
    branchId:  null,
  },
  admin: {
    id:        "offline-admin",
    email:     "admin@gokids.local",
    fullName:  "Admin (Offline)",
    role:      "admin",
    isActive:  true,
    branchId:  "offline-branch",
  },
  manager: {
    id:        "offline-manager",
    email:     "yonetici@gokids.local",
    fullName:  "Yönetici (Offline)",
    role:      "manager",
    isActive:  true,
    branchId:  "offline-branch",
  },
  staff: {
    id:        "offline-staff",
    email:     "personel@gokids.local",
    fullName:  "Personel (Offline)",
    role:      "staff",
    isActive:  true,
    branchId:  "offline-branch",
  },
  cashier: {
    id:        "offline-cashier",
    email:     "kasiyer@gokids.local",
    fullName:  "Kasiyer (Offline)",
    role:      "cashier",
    isActive:  true,
    branchId:  "offline-branch",
  },
}

export function isOfflineModeActive(): boolean {
  if (typeof window === "undefined") return false
  try { return !!window.localStorage.getItem(STORAGE_KEY) } catch { return false }
}

export function activateOfflineMode(role: UserRole = "admin"): UserProfile {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(STORAGE_KEY, role) } catch { /* swallow */ }
  }
  return OFFLINE_USERS[role]
}

export function deactivateOfflineMode(): void {
  if (typeof window === "undefined") return
  try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* swallow */ }
}

/** Returns the offline user persisted to localStorage, or null. */
export function readOfflineUser(): UserProfile | null {
  if (typeof window === "undefined") return null
  try {
    const role = window.localStorage.getItem(STORAGE_KEY) as UserRole | null
    if (!role) return null
    return OFFLINE_USERS[role] ?? null
  } catch {
    return null
  }
}

/**
 * Best-effort connectivity probe — does the configured Supabase URL respond?
 * We hit auth/v1/health with a tight timeout; if DNS fails, the project is
 * paused, or the network is down we get back `false`.
 */
export async function probeSupabaseReachable(): Promise<boolean> {
  if (typeof window === "undefined") return true
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return false
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${url}/auth/v1/health`, {
      method: "GET",
      signal: ctrl.signal,
      // Avoid CORS preflight by keeping it simple
      mode: "cors",
    })
    clearTimeout(timer)
    return res.ok || res.status === 404 // 404 also means the host responded
  } catch {
    return false
  }
}
