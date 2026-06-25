"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

// ─── useSessionPayments — read-only price / method aggregation ───────────────
//
// Batches a single PostgREST query that returns the payment rows for every
// currently-visible session, then groups them client-side. We only READ — no
// inserts, no updates, no RPCs. The hook is safe to mount/unmount freely.
//
// Returned shape per session id:
//
//   {
//     total:  number              // sum of total_amount across all rows
//     method: "cash"|"card"|"wallet"|"mixed"|"free"|"none"
//   }
//
// "mixed" means more than one method appears across this session's payment
// rows. "free" means a row exists with total 0. "none" means no row exists
// (no payment was ever recorded for the session).

export type DerivedMethod = "cash" | "card" | "wallet" | "mixed" | "free" | "none"

export interface SessionPaymentSummary {
  total:  number
  method: DerivedMethod
}

interface PaymentRow {
  session_id:    string
  cash_amount:   string | number | null
  card_amount:   string | number | null
  wallet_amount: string | number | null
  total_amount:  string | number | null
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  return typeof v === "number" ? v : Number(v) || 0
}

function pickMethod(rows: PaymentRow[]): DerivedMethod {
  if (rows.length === 0) return "none"
  const totals = rows.reduce(
    (acc, r) => {
      acc.cash   += num(r.cash_amount)
      acc.card   += num(r.card_amount)
      acc.wallet += num(r.wallet_amount)
      acc.total  += num(r.total_amount)
      return acc
    },
    { cash: 0, card: 0, wallet: 0, total: 0 },
  )
  if (totals.total === 0) return "free"
  const nonZero = (["cash", "card", "wallet"] as const).filter((k) => totals[k] > 0)
  if (nonZero.length === 0) return "none"
  if (nonZero.length > 1)   return "mixed"
  return nonZero[0]
}

export function useSessionPayments(
  sessionIds: string[],
): Record<string, SessionPaymentSummary> {
  const [summary, setSummary] = useState<Record<string, SessionPaymentSummary>>({})

  // Memoize the dependency by stringifying — the array identity changes every
  // render but the ids set is what matters.
  const key = sessionIds.slice().sort().join(",")

  useEffect(() => {
    let cancelled = false
    if (sessionIds.length === 0) {
      setSummary({})
      return
    }
    const supabase = createClient()
    void supabase
      .from("payments")
      .select("session_id, cash_amount, card_amount, wallet_amount, total_amount")
      .in("session_id", sessionIds)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        const grouped: Record<string, PaymentRow[]> = {}
        for (const row of data as PaymentRow[]) {
          if (!row.session_id) continue
          ;(grouped[row.session_id] ||= []).push(row)
        }
        const out: Record<string, SessionPaymentSummary> = {}
        for (const id of sessionIds) {
          const rows = grouped[id] ?? []
          out[id] = {
            total:  rows.reduce((s, r) => s + num(r.total_amount), 0),
            method: pickMethod(rows),
          }
        }
        setSummary(out)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return summary
}
