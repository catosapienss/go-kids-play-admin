"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/settings"

// ─── Settings Store ──────────────────────────────────────────────────────────
//
// Single source of truth for every operator-configurable knob. Persisted in
// localStorage so settings survive refreshes. The provider hydrates *after*
// mount (avoids SSR/CSR mismatch) and exposes a typed updater per section.
//
// Future: swap `loadFromStorage` / `saveToStorage` with Supabase
// `branch_settings` upsert — call sites stay identical.

const STORAGE_KEY = "gkp:settings:v1"

interface SettingsContextValue {
  settings: AppSettings
  /** Patch a single section. Triggers a save + downstream re-renders. */
  update: <K extends keyof AppSettings>(section: K, patch: Partial<AppSettings[K]>) => void
  /** Replace an entire section (useful for nested arrays like package list). */
  replace: <K extends keyof AppSettings>(section: K, value: AppSettings[K]) => void
  /** Reset all settings to defaults. */
  reset: () => void
  /** Indicates first-mount hydration is complete. */
  hydrated: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

// ─── Storage helpers ─────────────────────────────────────────────────────────

function loadFromStorage(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    // Merge with defaults so new fields added later still have values.
    return {
      general:       { ...DEFAULT_SETTINGS.general,       ...(parsed.general       ?? {}) },
      packages:      { ...DEFAULT_SETTINGS.packages,      ...(parsed.packages      ?? {}) },
      operations:    { ...DEFAULT_SETTINGS.operations,    ...(parsed.operations    ?? {}) },
      tv:            { ...DEFAULT_SETTINGS.tv,            ...(parsed.tv            ?? {}) },
      payments:      { ...DEFAULT_SETTINGS.payments,      ...(parsed.payments      ?? {}) },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications ?? {}) },
      staff:         { ...DEFAULT_SETTINGS.staff,         ...(parsed.staff         ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveToStorage(s: AppSettings): void {
  if (typeof window === "undefined") return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* swallow */ }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate after mount to avoid SSR/CSR mismatch.
  useEffect(() => {
    setSettings(loadFromStorage())
    setHydrated(true)
  }, [])

  const update = useCallback(<K extends keyof AppSettings>(
    section: K, patch: Partial<AppSettings[K]>,
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [section]: { ...prev[section], ...patch } }
      saveToStorage(next)
      return next
    })
  }, [])

  const replace = useCallback(<K extends keyof AppSettings>(
    section: K, value: AppSettings[K],
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [section]: value }
      saveToStorage(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    saveToStorage(DEFAULT_SETTINGS)
  }, [])

  const value = useMemo<SettingsContextValue>(() => ({
    settings, update, replace, reset, hydrated,
  }), [settings, update, replace, reset, hydrated])

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    // Safe default so components that render outside the provider still work.
    return {
      settings: DEFAULT_SETTINGS,
      update:   () => undefined,
      replace:  () => undefined,
      reset:    () => undefined,
      hydrated: false,
    }
  }
  return ctx
}

/** Quick accessor for a single section. */
export function useSettingsSection<K extends keyof AppSettings>(section: K): AppSettings[K] {
  return useSettings().settings[section]
}
