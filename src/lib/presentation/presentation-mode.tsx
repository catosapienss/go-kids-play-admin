"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

// ─── Presentation / Privacy Mode ─────────────────────────────────────────────
//
// A DISPLAY-ONLY toggle for capturing marketing screenshots without exposing
// real customer data. When enabled, PII (names, phones, notes, per-customer
// balances) is masked at render time with realistic fakes. NOTHING is written
// to the database — this only changes what the UI paints, and it can be turned
// off again instantly. State lives in localStorage.

interface PresentationValue {
  enabled: boolean
  setEnabled: (v: boolean) => void
  toggle: () => void
}

const Ctx = createContext<PresentationValue | null>(null)
const KEY = "gkp:presentation:enabled"

export function PresentationModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledRaw] = useState(false)

  useEffect(() => {
    try { setEnabledRaw(window.localStorage.getItem(KEY) === "1") } catch { /* noop */ }
  }, [])

  const setEnabled = useCallback((v: boolean) => {
    setEnabledRaw(v)
    try {
      if (v) window.localStorage.setItem(KEY, "1")
      else window.localStorage.removeItem(KEY)
    } catch { /* noop */ }
  }, [])

  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled])

  const value = useMemo(() => ({ enabled, setEnabled, toggle }), [enabled, setEnabled, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePresentationMode(): PresentationValue {
  return useContext(Ctx) ?? { enabled: false, setEnabled: () => undefined, toggle: () => undefined }
}

// ─── Masking helpers ─────────────────────────────────────────────────────────
//
// Deterministic: the same real value always maps to the same fake, so a given
// customer looks consistent across every screen (Dashboard, CRM, Active Game…).

const FAKE_FIRST = [
  "Deniz", "Ada", "Kaan", "Ela", "Mert", "Nil", "Arda", "Ece", "Efe", "Zeynep",
  "Emir", "Duru", "Poyraz", "Masal", "Toprak", "Lina", "Aras", "Bade", "Kuzey", "Işık",
]
const FAKE_LAST = [
  "Yıldız", "Demir", "Kaya", "Aydın", "Şahin", "Çelik", "Arslan", "Doğan", "Koç", "Türk",
  "Aksoy", "Bulut", "Ateş", "Güneş", "Deniz", "Korkmaz", "Yalın", "Ercan", "Bora", "Uçar",
]

function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h
}

/** Realistic fake full name, stable per input. */
export function fakeName(real: string): string {
  const h = hash(real || "x")
  const parts = (real || "").trim().split(/\s+/)
  const first = FAKE_FIRST[h % FAKE_FIRST.length]
  // Single-token inputs (a child's first name) stay single-token.
  if (parts.length <= 1) return first
  const last = FAKE_LAST[(h >> 5) % FAKE_LAST.length]
  return `${first} ${last}`
}

/** Realistic but fake TR mobile number, stable per input. */
export function fakePhone(real: string): string {
  const h = hash(real || "0")
  const d = String(h).padStart(9, "0").slice(0, 9)
  return `0530 ${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)}`
}

// ─── Hook returning bound mask functions ─────────────────────────────────────

export interface Masker {
  enabled: boolean
  name:   (v: string | null | undefined) => string
  phone:  (v: string | null | undefined) => string
  /** Mask a per-customer money value (wallet / lifetime spend) → ₺•••• */
  money:  (v: string | number | null | undefined, fallback?: string) => string | null
  /** Mask a free-text note. */
  note:   (v: string | null | undefined) => string | null
}

export function useMask(): Masker {
  const { enabled } = usePresentationMode()
  return useMemo<Masker>(() => ({
    enabled,
    name:  (v) => enabled ? fakeName(v ?? "") : (v ?? ""),
    phone: (v) => enabled ? fakePhone(v ?? "") : (v ?? ""),
    money: (v, fallback) => {
      if (!enabled) return v == null ? (fallback ?? null) : String(v)
      return "₺••••"
    },
    note:  (v) => enabled ? (v ? "••••••" : v ?? null) : (v ?? null),
  }), [enabled])
}
