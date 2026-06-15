"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useBranchScope } from "@/lib/branch/branch-context"
import { branchChannelName, branchPostgresFilter } from "@/lib/branch/realtime-channel"
import {
  getDashboardMetrics,
  getHourlyHeatmap,
  getDailyRevenueTrend,
  getPaymentSplit,
  getStaffMetrics,
  getPackageMetrics,
  getExtensionMetrics,
  getEventSummary,
  type DashboardMetrics,
  type HourlyBucket,
  type RevenueDailyPoint,
  type PaymentSplit,
  type StaffMetric,
  type PackageMetric,
  type ExtensionMetric,
  type EventSummary,
} from "@/lib/services/analytics.service"

// ─── Generic analytic-fetch hook ──────────────────────────────────────────────
//
// The shape that every panel needs: { data, isLoading, error, refresh() }.
// `realtimeTables` lets a panel subscribe to one or more Supabase tables and
// automatically debounce-refresh when something changes downstream.

interface UseAnalyticOpts {
  /** Tables to subscribe to. Refresh fires (debounced 400ms) on INSERT/UPDATE. */
  realtimeTables?: string[]
  /** Optional polling interval — useful for countdown-driven widgets. */
  pollMs?: number
}

function useAnalytic<T>(
  loader: () => Promise<T>,
  opts: UseAnalyticOpts = {},
) {
  const scope = useBranchScope()
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaderRef = useRef(loader)
  useEffect(() => { loaderRef.current = loader }, [loader])

  const refresh = useCallback(async () => {
    try {
      const result = await loaderRef.current()
      setData(result)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Veri yüklenemedi"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(refresh, 400)
  }, [refresh])

  // Refresh whenever the active branch changes — old data would be misleading.
  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh, scope.branchId, scope.isSuperAdmin])

  useEffect(() => {
    if (!opts.realtimeTables?.length) return
    const supabase = createClient()
    const channelName = branchChannelName(
      `analytics-${opts.realtimeTables.join("-")}`,
      scope.branchId ?? null,
    )
    const channel = supabase.channel(channelName)
    const filter = branchPostgresFilter(scope.branchId)

    for (const table of opts.realtimeTables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => scheduleRefresh(),
      )
    }
    channel.subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      void supabase.removeChannel(channel)
    }
  }, [opts.realtimeTables, scheduleRefresh, scope.branchId])

  useEffect(() => {
    if (!opts.pollMs) return
    const id = setInterval(refresh, opts.pollMs)
    return () => clearInterval(id)
  }, [opts.pollMs, refresh])

  return { data, isLoading, error, refresh }
}

// ─── Concrete hooks for each panel ────────────────────────────────────────────

// Each concrete hook reads the active branch scope and forwards it to the
// service — service functions then add `branch_id` filtering on every query.

export function useDashboardMetrics() {
  const scope = useBranchScope()
  const loader = useMemo(() => () => getDashboardMetrics(scope), [scope])
  return useAnalytic<DashboardMetrics>(
    loader,
    { realtimeTables: ["sessions", "payments", "wallet_transactions", "refund_logs"], pollMs: 30_000 },
  )
}

export function useHourlyHeatmap() {
  const scope = useBranchScope()
  const loader = useMemo(() => () => getHourlyHeatmap(scope), [scope])
  return useAnalytic<HourlyBucket[]>(
    loader,
    { realtimeTables: ["sessions", "payments"], pollMs: 60_000 },
  )
}

export function useDailyRevenueTrend(days = 7) {
  const scope = useBranchScope()
  const loader = useMemo(() => () => getDailyRevenueTrend(days, scope), [days, scope])
  return useAnalytic<RevenueDailyPoint[]>(
    loader,
    { realtimeTables: ["payments", "refund_logs"], pollMs: 60_000 },
  )
}

export function usePaymentSplit() {
  const scope = useBranchScope()
  const loader = useMemo(() => () => getPaymentSplit(scope), [scope])
  return useAnalytic<PaymentSplit[]>(
    loader,
    { realtimeTables: ["payments"], pollMs: 30_000 },
  )
}

export function useStaffMetrics() {
  const scope = useBranchScope()
  const loader = useMemo(() => () => getStaffMetrics(scope), [scope])
  return useAnalytic<StaffMetric[]>(
    loader,
    { realtimeTables: ["sessions", "refund_logs"], pollMs: 60_000 },
  )
}

export function usePackageMetrics() {
  const scope = useBranchScope()
  const loader = useMemo(() => () => getPackageMetrics(scope), [scope])
  return useAnalytic<PackageMetric[]>(
    loader,
    { realtimeTables: ["sessions"], pollMs: 60_000 },
  )
}

export function useExtensionMetrics() {
  const scope = useBranchScope()
  const loader = useMemo(() => () => getExtensionMetrics(scope), [scope])
  return useAnalytic<ExtensionMetric>(
    loader,
    { realtimeTables: ["session_extensions", "sessions"], pollMs: 60_000 },
  )
}

export function useEventSummary() {
  const scope = useBranchScope()
  const loader = useMemo(() => () => getEventSummary(scope), [scope])
  return useAnalytic<EventSummary>(
    loader,
    { pollMs: 5 * 60_000 }, // 5min
  )
}
