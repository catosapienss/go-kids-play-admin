"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useAuth } from "@/contexts/auth-context"
import { isSuperAdmin } from "@/types/auth"
import { listBranches } from "@/lib/services/branch.service"
import type { Branch } from "@/types/branch"
import type { BranchScope } from "./scoped-query"

// ─── Branch Context ───────────────────────────────────────────────────────────
//
// Single source of truth for the *active* branch the UI is currently scoped to.
//
//   • Regular users: pinned to their `profile.branch_id` — switching disabled.
//   • Super admins: can pick any branch (or `null` = "All branches" view).
//                   Selection persists in localStorage across reloads.
//
// All hooks downstream (analytics, realtime, notifications) read from here so
// turning the branch dial in the header instantly re-scopes the whole app.

interface BranchContextValue {
  /** All branches the caller is allowed to see (active only). */
  branches: Branch[]
  /** The currently active branch, or null = super-admin "all branches" view. */
  activeBranch: Branch | null
  activeBranchId: string | null
  /** Convenience: ready-to-use scope for `withBranchScope()`. */
  scope: BranchScope
  /** Whether the caller may switch branches. */
  canSwitch: boolean
  /** Loading state for the branches list. */
  isLoading: boolean
  /** Set the active branch (super-admin only). Pass `null` for "all branches". */
  setActiveBranch: (id: string | null) => void
  /** Force a refresh of the branches list. */
  refresh: () => Promise<void>
}

const BranchContext = createContext<BranchContextValue | null>(null)

const STORAGE_KEY = "gkp:active-branch"

function loadSavedBranchId(): string | null {
  if (typeof window === "undefined") return null
  try { return window.localStorage.getItem(STORAGE_KEY) } catch { return null }
}

function persistBranchId(id: string | null) {
  if (typeof window === "undefined") return
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch { /* swallow */ }
}

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setLoading] = useState(true)
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null)

  // ── Load branches list (depends on RLS; non-super-admins see only theirs) ──

  const refresh = useCallback(async () => {
    if (!user) {
      setBranches([])
      setLoading(false)
      return
    }
    try {
      const list = await listBranches()
      setBranches(list)
    } catch {
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // ── Compute the active branch ────────────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setActiveBranchIdState(null)
      return
    }
    if (isSuperAdmin(user.role)) {
      // Super-admin: restore last selection or default to "all".
      const saved = loadSavedBranchId()
      setActiveBranchIdState(saved)
    } else {
      // Regular user: pinned to profile.branchId.
      setActiveBranchIdState(user.branchId ?? null)
    }
  }, [user])

  const setActiveBranch = useCallback((id: string | null) => {
    if (!user || !isSuperAdmin(user.role)) {
      // Silently ignore — UI must already gate the switcher.
      return
    }
    persistBranchId(id)
    setActiveBranchIdState(id)
  }, [user])

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) ?? null,
    [branches, activeBranchId],
  )

  const canSwitch = !!user && isSuperAdmin(user.role)

  const scope = useMemo<BranchScope>(() => ({
    branchId:     activeBranchId,
    isSuperAdmin: canSwitch,
  }), [activeBranchId, canSwitch])

  const value = useMemo<BranchContextValue>(() => ({
    branches,
    activeBranch,
    activeBranchId,
    scope,
    canSwitch,
    isLoading,
    setActiveBranch,
    refresh,
  }), [branches, activeBranch, activeBranchId, scope, canSwitch, isLoading, setActiveBranch, refresh])

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext)
  if (!ctx) {
    throw new Error("useBranch must be used inside <BranchProvider>")
  }
  return ctx
}

/** Compact hook for services / queries — returns only the scope. */
export function useBranchScope(): BranchScope {
  return useBranch().scope
}
