import type { RealtimePostgresChangesFilter } from "@supabase/supabase-js"

// ─── Branch-aware realtime channel helpers ────────────────────────────────────
//
// Two complementary techniques:
//
//   1. **Naming**: a per-branch channel name (`brn-<id>-<purpose>`) prevents
//      cross-tab subscription collisions and lets the server multiplex efficiently.
//
//   2. **Filtering**: server-side filter `branch_id=eq.<id>` so the client
//      only receives changes for its own branch. Saves bandwidth and is the
//      hard guarantee (RLS protects the underlying rows).

export function branchChannelName(purpose: string, branchId: string | null): string {
  return branchId
    ? `brn-${branchId.slice(0, 8)}-${purpose}`
    : `global-${purpose}`
}

/**
 * Build the `filter` string for a postgres_changes subscription so the server
 * only sends rows for the active branch.
 *
 *   subscribePostgresChanges(channel, {
 *     event: "INSERT", schema: "public", table: "sessions",
 *     filter: branchPostgresFilter(branchId),
 *   })
 *
 * Returns `undefined` for super-admin "all branches" mode — caller passes the
 * filter through directly.
 */
export function branchPostgresFilter(branchId: string | null | undefined): string | undefined {
  if (!branchId) return undefined
  return `branch_id=eq.${branchId}`
}

/** Convenience: produce a complete `postgres_changes` filter object. */
export function branchPostgresChanges<T extends string>(
  table: T,
  branchId: string | null | undefined,
  event: "INSERT" | "UPDATE" | "DELETE" | "*" = "*",
): RealtimePostgresChangesFilter<"*"> {
  const filter = branchPostgresFilter(branchId)
  return {
    event,
    schema: "public",
    table,
    ...(filter ? { filter } : {}),
  } as RealtimePostgresChangesFilter<"*">
}
