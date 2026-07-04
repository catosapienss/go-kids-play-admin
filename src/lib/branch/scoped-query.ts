// ─── Branch-scoped Supabase query helper ──────────────────────────────────────
//
// Defence-in-depth pattern:
//
//   • RLS already prevents cross-branch reads/writes server-side.
//   • This helper *additionally* scopes the query client-side so super admins
//     who haven't picked a branch see exactly what they expect (their selected
//     branch when one is active; everything when none is selected).
//   • It also keeps the realtime payload filter consistent.
//
// Usage:
//
//   const q = createClient().from("sessions").select("*")
//   const { data } = await withBranchScope(q, scope).gte("created_at", since)
//
// For super admins with no active branch, the helper is a no-op — RLS via
// `is_super_admin()` lets them see everything.

export interface BranchScope {
  /** Currently active branch id, or null for "all branches". */
  branchId: string | null | undefined
  /** Whether the caller is a super_admin (can see all when branchId is null). */
  isSuperAdmin: boolean
}

/**
 * Supabase's filter-builder type is heavily generic; trying to thread the
 * full type through here creates "type instantiation excessively deep" errors.
 * The runtime contract is simple: every Supabase filter builder exposes
 * `.eq(column, value)` and returns the same builder for chaining.
 */
interface EqChain<Self> {
  eq(column: string, value: unknown): Self
}

/**
 * Apply branch_id filter to a Supabase query builder. Returns the same builder
 * (chainable) so call sites read naturally.
 */
export function withBranchScope<Q extends EqChain<Q>>(query: Q, scope: BranchScope): Q {
  if (scope.isSuperAdmin && !scope.branchId) {
    // Super-admin viewing all branches — leave the query unfiltered.
    return query
  }
  if (!scope.branchId) {
    // Single-shop mode: user has no branch_id assigned. Return the query
    // UNFILTERED — RLS is the authoritative guard now. Previous behaviour
    // ("branch_id = __no_branch__") hard-hid all rows from staff who
    // weren't wired to a branch, which broke every dashboard KPI.
    return query
  }
  return query.eq("branch_id", scope.branchId)
}

/**
 * Build the column shape for an insert that should be branch-attributed.
 * (The DB trigger fills this in automatically — this is for clarity when
 * the app needs to set it explicitly, e.g. super_admin acting on a branch.)
 */
export function withBranchOnInsert<T extends Record<string, unknown>>(
  payload: T,
  branchId: string | null | undefined,
): T & { branch_id?: string | null } {
  if (!branchId) return payload
  return { ...payload, branch_id: branchId }
}
