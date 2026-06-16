"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"

// ─── Session Lock ─────────────────────────────────────────────────────────────
//
// After IDLE_MS of no input the screen is covered with a lock overlay. The
// user is NOT signed out — their Supabase session persists; only the UI is
// gated behind a 4-digit PIN check via verify_pin().
//
// Public/kiosk routes (login, /tv, /canli, /parent, /app) are exempt so the
// guest-facing displays never blank out.

const IDLE_MS = 15 * 60 * 1000 // 15 minutes

const EXEMPT_PREFIXES = ["/login", "/tv", "/canli", "/parent", "/app"]

interface SessionLockValue {
  locked: boolean
  /** Verify a PIN and unlock on success. Returns true if accepted. */
  verifyPin: (pin: string) => Promise<boolean>
  /** Manually lock right now (e.g. lock-now button in the header). */
  lockNow: () => void
}

const SessionLockContext = createContext<SessionLockValue | null>(null)

export function SessionLockProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname() ?? "/"
  const [locked, setLocked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const exempt = EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))

  const armTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!user || exempt || locked) return
    timerRef.current = setTimeout(() => setLocked(true), IDLE_MS)
  }, [user, exempt, locked])

  // Track user activity to keep the timer alive.
  useEffect(() => {
    if (!user || exempt) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    const reset = () => armTimer()
    armTimer()

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [user, exempt, armTimer])

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!/^[0-9]{4}$/.test(pin)) return false
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("verify_pin", { p_pin: pin })
      if (error) {
        console.error("[lock] verify_pin error", error)
        return false
      }
      if (data === true) {
        setLocked(false)
        armTimer()
        return true
      }
      return false
    } catch (err) {
      console.error("[lock] verify_pin exception", err)
      return false
    }
  }, [armTimer])

  const lockNow = useCallback(() => {
    if (!user || exempt) return
    setLocked(true)
  }, [user, exempt])

  return (
    <SessionLockContext.Provider value={{ locked, verifyPin, lockNow }}>
      {children}
    </SessionLockContext.Provider>
  )
}

export function useSessionLock() {
  const ctx = useContext(SessionLockContext)
  if (!ctx) throw new Error("useSessionLock must be used inside <SessionLockProvider>")
  return ctx
}
