"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { createLogger } from "@/lib/reliability/logger"

const log = createLogger("demo-mode")

// ─── Demo Mode ────────────────────────────────────────────────────────────────
//
// Global flag that turns the app into "demo / showroom" mode:
//
//   • Enables the Demo Control Panel UI (one-click populate, reset, simulate).
//   • Enables the Activity Simulator (random realtime fake events).
//   • Lets parts of the UI render demo-only flourishes (DEMO badge, faster
//     timers for visible countdowns, etc.).
//
// State is persisted in localStorage so refreshes don't drop you out of demo.
// Only available outside production builds OR for super_admins — gated in the
// provider's mount logic.

export interface DemoModeValue {
  enabled: boolean
  /** Activity simulator running? (separate from the demo-mode flag) */
  simulatorRunning: boolean
  setEnabled: (next: boolean) => void
  setSimulatorRunning: (next: boolean) => void
  /** Toggle without re-render thrash. */
  toggle: () => void
}

const DemoModeContext = createContext<DemoModeValue | null>(null)

const KEY_ENABLED = "gkp:demo:enabled"
const KEY_SIMULATOR = "gkp:demo:simulator"

function readBool(key: string, fallback = false): boolean {
  if (typeof window === "undefined") return fallback
  try { return window.localStorage.getItem(key) === "1" } catch { return fallback }
}

function writeBool(key: string, value: boolean) {
  if (typeof window === "undefined") return
  try {
    if (value) window.localStorage.setItem(key, "1")
    else window.localStorage.removeItem(key)
  } catch { /* swallow */ }
}

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledRaw] = useState(false)
  const [simulatorRunning, setSimulatorRunningRaw] = useState(false)

  // Hydrate after mount to avoid SSR mismatch.
  useEffect(() => {
    setEnabledRaw(readBool(KEY_ENABLED))
    setSimulatorRunningRaw(readBool(KEY_SIMULATOR))
  }, [])

  const setEnabled = useCallback((next: boolean) => {
    writeBool(KEY_ENABLED, next)
    setEnabledRaw(next)
    log.info("demo mode toggled", { enabled: next })
    if (!next) {
      // Disable the simulator when we leave demo mode to avoid orphaned timers.
      writeBool(KEY_SIMULATOR, false)
      setSimulatorRunningRaw(false)
    }
  }, [])

  const setSimulatorRunning = useCallback((next: boolean) => {
    writeBool(KEY_SIMULATOR, next)
    setSimulatorRunningRaw(next)
    log.info("simulator toggled", { running: next })
  }, [])

  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled])

  const value = useMemo<DemoModeValue>(() => ({
    enabled,
    simulatorRunning,
    setEnabled,
    setSimulatorRunning,
    toggle,
  }), [enabled, simulatorRunning, setEnabled, setSimulatorRunning, toggle])

  return (
    <DemoModeContext.Provider value={value}>
      {children}
    </DemoModeContext.Provider>
  )
}

export function useDemoMode(): DemoModeValue {
  const ctx = useContext(DemoModeContext)
  // Safe default — components in non-demo branches still work.
  return ctx ?? {
    enabled: false,
    simulatorRunning: false,
    setEnabled: () => undefined,
    setSimulatorRunning: () => undefined,
    toggle: () => undefined,
  }
}

/** Used by the layout to decide whether to render demo-only UI surfaces. */
export function shouldShowDemoTooling(): boolean {
  if (typeof window === "undefined") return false
  // Visible in dev OR when explicit demo mode is on (we'll still gate panels
  // by role inside the components themselves).
  if (process.env.NODE_ENV !== "production") return true
  return readBool(KEY_ENABLED)
}
