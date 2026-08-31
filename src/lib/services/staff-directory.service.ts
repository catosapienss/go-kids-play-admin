import { createClient } from "@/lib/supabase/client"

// ─── Staff directory ─────────────────────────────────────────────────────────
//
// One place that answers "who works here right now, and who used to?".
//
// Historical rows never store a foreign key to a *living* employee — they
// store either the profile id or, more often, a denormalised copy of the name
// (`sessions.staff_name`, `audit_logs.meta.submitted_by`). So a departed
// employee's name keeps showing up in reports forever, which is exactly what
// we want. This directory is what lets the UI *label* those rows "Ayrıldı"
// instead of pretending the person is still on the payroll.
//
// Defensive about `profiles.left_at` (migration 041): if the column isn't
// deployed yet the query is retried without it and the older
// disabled/is_active flags carry the meaning on their own.

export interface StaffDirectoryEntry {
  id: string
  username: string | null
  fullName: string | null
  role: string
  /** False once the account has been archived — cannot log in, cannot transact. */
  active: boolean
  /** ISO date the person left, when known. Null for current staff. */
  leftAt: string | null
  archivedReason: string | null
}

const MISSING_COLUMN = "42703"

function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === MISSING_COLUMN || (err.message ?? "").includes("left_at")
}

export async function getStaffDirectory(): Promise<StaffDirectoryEntry[]> {
  const supabase = createClient()

  const withLifecycle = await supabase
    .from("profiles")
    .select("id, username, full_name, role, is_active, disabled, left_at, archived_reason")

  const rows =
    !withLifecycle.error
      ? withLifecycle.data
      : isMissingColumn(withLifecycle.error)
        ? (
            await supabase
              .from("profiles")
              .select("id, username, full_name, role, is_active, disabled")
          ).data
        : null

  if (!rows) return []

  return (rows as Array<Record<string, unknown>>).map((r) => {
    const leftAt = (r.left_at as string | null) ?? null
    const disabled = (r.disabled as boolean | null) ?? false
    return {
      id: r.id as string,
      username: (r.username as string | null) ?? null,
      fullName: (r.full_name as string | null) ?? null,
      role: (r.role as string | null) ?? "staff",
      // `is_active` is intentionally not part of this — see the note in
      // auth-context's isArchived(). Archiving sets disabled + left_at.
      active: !disabled && leftAt === null,
      leftAt,
      archivedReason: (r.archived_reason as string | null) ?? null,
    }
  })
}

/**
 * Names of everyone who has LEFT, lower-cased for matching against the
 * denormalised `staff_name` text carried on historical rows.
 *
 * Name matching is deliberately the fallback of last resort — it is only used
 * to decorate a report row with an "Ayrıldı" badge, never to filter money or
 * to rewrite what a historical row says.
 */
export function formerStaffNames(dir: StaffDirectoryEntry[]): Set<string> {
  const out = new Set<string>()
  for (const e of dir) {
    if (!e.active && e.fullName) out.add(e.fullName.trim().toLocaleLowerCase("tr-TR"))
  }
  return out
}

export function isFormerStaffName(name: string, former: Set<string>): boolean {
  return former.has(name.trim().toLocaleLowerCase("tr-TR"))
}
