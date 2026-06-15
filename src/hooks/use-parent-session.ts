"use client"

import { useCallback, useEffect, useState } from "react"
import {
  signInWithCode, refreshParent,
  type ParentBundle,
} from "@/lib/services/parent-portal.service"
import { createLogger } from "@/lib/reliability/logger"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"

const log = createLogger("parent-session")
const STORAGE_KEY = "gkp:parent:code"

// ─── useParentSession ─────────────────────────────────────────────────────────
//
// The customer-side equivalent of an auth context. Holds:
//   • The parent's code (persisted in localStorage so the app opens to "home")
//   • The hydrated parent + children bundle
//   • Loading / error state for first-load + reconnect refresh
//
// Sign-in flow: parent types code → signInWithCode → store + persist.
// Wallet balance auto-refreshes when the realtime-supervisor pings reconnect.

export interface ParentSessionState {
  bundle: ParentBundle | null
  isLoading: boolean
  error: string | null
  signIn: (code: string) => Promise<void>
  signOut: () => void
  /** Force a fresh fetch of parent + children. */
  refresh: () => Promise<void>
}

function readStoredCode(): string | null {
  if (typeof window === "undefined") return null
  try { return window.localStorage.getItem(STORAGE_KEY) } catch { return null }
}
function persistCode(code: string | null) {
  if (typeof window === "undefined") return
  try {
    if (code) window.localStorage.setItem(STORAGE_KEY, code)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch { /* swallow */ }
}

export function useParentSession(): ParentSessionState {
  const [bundle, setBundle] = useState<ParentBundle | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  // Bootstrap from stored code on mount.
  useEffect(() => {
    const code = readStoredCode()
    if (!code) {
      setLoading(false)
      return
    }
    let cancelled = false
    void signInWithCode(code)
      .then((b) => { if (!cancelled) setBundle(b) })
      .catch((e) => {
        // Code went stale — clear it so the sign-in screen re-appears.
        log.warn("stored code rejected", { code }, e)
        persistCode(null)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Reconnect → refresh parent record (so wallet balance is fresh).
  useEffect(() => {
    if (!bundle) return
    let cancelled = false
    void refreshParent(bundle.parent.id)
      .then((p) => {
        if (cancelled || !p) return
        setBundle((prev) => prev ? { ...prev, parent: p } : prev)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [reconnectToken, bundle?.parent.id])

  const signIn = useCallback(async (code: string) => {
    setError(null)
    setLoading(true)
    try {
      const b = await signInWithCode(code)
      setBundle(b)
      persistCode(b.code)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Giriş başarısız"
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(() => {
    persistCode(null)
    setBundle(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!bundle) return
    const fresh = await refreshParent(bundle.parent.id)
    if (fresh) setBundle({ ...bundle, parent: fresh })
  }, [bundle])

  return { bundle, isLoading, error, signIn, signOut, refresh }
}
