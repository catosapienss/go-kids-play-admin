"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { defaultRouteForRole } from "@/lib/permissions"
import { isOfflineModeActive, readOfflineUser } from "@/lib/auth/offline-mode"
import { toAuthEmail } from "@/lib/auth/username"
import type { UserProfile, UserRole } from "@/types/auth"

interface AuthContextValue {
  user: UserProfile | null
  loading: boolean
  /** Diagnostic field — explains where the user record came from. */
  roleSource: "supabase-full" | "supabase-fallback" | "auth-only" | "offline-mode" | "none"
  /** Sign in with either a username (preferred) or a legacy email. */
  signIn: (identifier: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

// ─── Archived-account guard ──────────────────────────────────────────────────
//
// A departed employee keeps their profile row forever (every historical
// session, closing and report resolves their name through it). What they lose
// is the ability to *use* the account. Migration 041 revokes that at three
// layers — auth.users.banned_until, the staff_quick_auth credential mirror,
// and these profile flags. This is the app-side layer: whatever the auth
// server decides, an archived profile never becomes a logged-in user here.

export const ARCHIVED_ACCOUNT_ERROR = "ACCOUNT_ARCHIVED"

function isArchived(row: Record<string, unknown>): boolean {
  // Deliberately keyed on `disabled` and `left_at` only.
  //
  // `is_active` is NOT consulted: it predates this flow, nothing in the UI
  // ever surfaced it, and a legacy row carrying is_active=false would lock a
  // working employee out mid-shift. Archiving sets all three, so the two
  // flags checked here are always enough to recognise a departed account —
  // without betting anyone's shift on a column whose history we can't see.
  //
  // `left_at` may not exist yet on an un-migrated database; absent reads as
  // undefined and `disabled` carries the meaning on its own.
  if ((row.disabled as boolean | null | undefined) === true) return true
  if (row.left_at != null) return true
  return false
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleSource, setRoleSource] = useState<AuthContextValue["roleSource"]>("none")
  const router = useRouter()

  // Tear down a session that belongs to an archived account. Called from
  // loadProfile for both the login path and the "restore session on mount"
  // path, so an employee archived mid-shift is dropped on their next reload.
  const rejectArchivedSession = useCallback(async (email: string) => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setRoleSource("none")
    console.warn("[auth] archived account rejected:", email)
  }, [])

  // ─── Role loading ─────────────────────────────────────────────────────────
  //
  // Original implementation silently downgraded to "cashier" whenever the
  // profile query failed. That masked a real bug — when migration 005's
  // `branch_id` column wasn't applied, the SELECT errored out and every user
  // (even admins) was shown the staff sidebar.
  //
  // New behaviour:
  //   1. Try the FULL query (with branch_id).
  //   2. If it fails because the column is missing, retry WITHOUT branch_id
  //      so the role still loads correctly.
  //   3. Only fall back to "cashier" if BOTH queries fail.
  //   4. Surface a visible warning toast when the fallback runs.
  //
  // Returns the role + source so signIn can act on it without re-querying.
  const loadProfile = useCallback(
    async (userId: string, email: string): Promise<UserRole | null> => {
      const supabase = createClient()

      // Attempt 1 — full shape including branch_id (migration 005 applied).
      const full = await supabase
        .from("profiles")
        .select("full_name, phone, role, is_active, branch_id, username, permissions, last_login_at, disabled")
        .eq("id", userId)
        .single()

      if (!full.error && full.data) {
        // Archived / disabled employee — Supabase Auth happily issued a
        // session (it never looks at public.profiles), so the app has to be
        // the one that says no. Migration 041 also sets auth.users.banned_until
        // so this normally never fires; it stays as the belt to that braces,
        // and it is what protects an account disabled purely from /personeller.
        if (isArchived(full.data as Record<string, unknown>)) {
          await rejectArchivedSession(email)
          return null
        }

        const role = (full.data.role as UserRole) ?? "cashier"
        setUser({
          id: userId,
          email,
          fullName: full.data.full_name ?? email,
          phone: full.data.phone ?? undefined,
          role,
          isActive: full.data.is_active ?? true,
          branchId: (full.data.branch_id as string | null) ?? null,
          username: (full.data.username as string | null) ?? null,
          permissions: (full.data.permissions as Record<string, boolean> | null) ?? {},
          lastLoginAt: (full.data.last_login_at as string | null) ?? null,
          disabled: (full.data.disabled as boolean | null) ?? false,
        })
        setRoleSource("supabase-full")
        return role
      }

      // Attempt 2 — schema missing branch_id; query without it so role still loads.
      const missingBranchCol =
        full.error?.message?.includes("branch_id") ||
        (full.error as { code?: string })?.code === "42703"

      if (missingBranchCol) {
        const minimal = await supabase
          .from("profiles")
          .select("full_name, phone, role, is_active")
          .eq("id", userId)
          .single()

        if (!minimal.error && minimal.data) {
          if (isArchived(minimal.data as Record<string, unknown>)) {
            await rejectArchivedSession(email)
            return null
          }
          const role = (minimal.data.role as UserRole) ?? "cashier"
          setUser({
            id: userId,
            email,
            fullName: minimal.data.full_name ?? email,
            phone: minimal.data.phone ?? undefined,
            role,
            isActive: minimal.data.is_active ?? true,
            branchId: null,
          })
          setRoleSource("supabase-fallback")
          // Loud warning so the operator knows the schema needs the recovery SQL.
          // (Only fires when migration 005 hasn't been applied — a one-off issue.)
          if (typeof window !== "undefined") {
            console.warn(
              "[auth] profiles.branch_id missing — using fallback query. " +
              "Run scripts/recovery-roles.sql in Supabase SQL Editor.",
            )
          }
          return role
        }
      }

      // Attempt 3 — completely no profile data. Surface the failure visibly.
      console.error("[auth] profile load failed", full.error)
      setUser({
        id: userId,
        email,
        fullName: email,
        // No data → conservative default but NOT "cashier" silently.
        // We use "manager" as the conservative *visible* fallback so an admin
        // logging in for the first time before SQL seeding still sees their
        // dashboard. Real role gating is restored once the profile row exists.
        role: "manager",
        isActive: true,
        branchId: null,
      })
      setRoleSource("auth-only")
      toast.error("Profil yüklenemedi — geçici manager yetkisi ile devam ediyor", {
        description: full.error?.message?.slice(0, 120) ?? "Bilinmeyen hata",
      })
      return "manager"
    },
    [rejectArchivedSession],
  )

  // ─── Bootstrap session from cookie on mount ──────────────────────────────
  useEffect(() => {
    // Offline mode shortcut — if the operator activated demo-without-Supabase
    // mode, hydrate from localStorage and skip Supabase entirely.
    if (isOfflineModeActive()) {
      const offline = readOfflineUser()
      if (offline) {
        setUser(offline)
        setRoleSource("offline-mode")
        setLoading(false)
        return
      }
    }

    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? "").finally(() =>
          setLoading(false),
        )
      } else {
        setLoading(false)
      }
    })

    // Keep auth state in sync (tab focus, token refresh, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? "")
      } else if (!isOfflineModeActive()) {
        setUser(null)
        setRoleSource("none")
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const supabase = createClient()
      const email = toAuthEmail(identifier)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const role = await loadProfile(session.user.id, session.user.email ?? "")
        // Archived employee — loadProfile has already signed the session back
        // out. Surface it as a login failure rather than a blank dashboard.
        if (role === null) throw new Error(ARCHIVED_ACCOUNT_ERROR)
        // Best-effort last-login stamp. Failure is non-fatal.
        supabase.rpc("touch_last_login").then(() => undefined, () => undefined)
        router.push(defaultRouteForRole(role))
        router.refresh()
      }
    },
    [loadProfile, router],
  )

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setRoleSource("none")
    toast.success("Çıkış yapıldı")
    router.push("/login")
    router.refresh()
  }, [router])

  return (
    <AuthContext.Provider value={{ user, loading, roleSource, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
