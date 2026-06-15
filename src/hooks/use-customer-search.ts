"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { searchCustomers, getRecentCustomers } from "@/lib/services/customer.service"
import type { CustomerSummary } from "@/types/customer"
import { createLogger } from "@/lib/reliability/logger"

const log = createLogger("customer-search")

// ─── useCustomerSearch ────────────────────────────────────────────────────────
//
// Debounced customer search hook with built-in "recent customers" fallback
// when the query is empty.
//
//   • 220ms debounce — feels instant on tablet, avoids hammering the RPC
//   • Cancellation via abort token so stale responses don't overwrite fresh ones
//   • Recents are cached for the lifetime of the component instance

export interface CustomerSearchState {
  query: string
  setQuery: (q: string) => void
  /** Active results — either search hits or recents when query is blank. */
  results: CustomerSummary[]
  /** Whether the displayed results are the "recents" view. */
  isRecents: boolean
  isLoading: boolean
  error: string | null
}

export function useCustomerSearch(opts: { initialQuery?: string; limit?: number } = {}): CustomerSearchState {
  const [query, setQuery] = useState(opts.initialQuery ?? "")
  const [results, setResults] = useState<CustomerSummary[]>([])
  const [isRecents, setIsRecents] = useState(true)
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seqRef = useRef(0)
  const recentsRef = useRef<CustomerSummary[] | null>(null)
  const limit = opts.limit ?? 12

  // Always have a "recents" frame ready to display when query empties.
  const loadRecents = useCallback(async () => {
    if (recentsRef.current) {
      setResults(recentsRef.current)
      return
    }
    setLoading(true)
    try {
      const rows = await getRecentCustomers(8)
      recentsRef.current = rows
      setResults(rows)
      setError(null)
    } catch (e) {
      log.warn("recents load failed", undefined, e)
      setError(e instanceof Error ? e.message : "Veri yüklenemedi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (query.trim().length === 0) {
      setIsRecents(true)
      void loadRecents()
      return
    }
    if (query.trim().length < 2) {
      // Treat as "still typing" — keep recents visible, don't trigger search yet.
      return
    }

    setIsRecents(false)
    setLoading(true)
    const mySeq = ++seqRef.current
    const t = setTimeout(async () => {
      try {
        const rows = await searchCustomers(query.trim(), limit)
        if (mySeq === seqRef.current) {
          setResults(rows)
          setError(null)
        }
      } catch (e) {
        if (mySeq === seqRef.current) {
          setError(e instanceof Error ? e.message : "Arama başarısız")
        }
      } finally {
        if (mySeq === seqRef.current) setLoading(false)
      }
    }, 220)
    return () => clearTimeout(t)
  }, [query, limit, loadRecents])

  return { query, setQuery, results, isRecents, isLoading, error }
}
