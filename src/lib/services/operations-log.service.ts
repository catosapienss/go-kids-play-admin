import { createClient } from "@/lib/supabase/client"
import { withBranchScope, withBranchOnInsert, type BranchScope } from "@/lib/branch/scoped-query"
import { recordAudit } from "@/lib/reliability/audit-log"
import {
  dbRowToOperationNote, type OperationNote, type DbOperationNoteRow,
} from "@/types/operations-log"

// ─── Daily Operations Log service ────────────────────────────────────────────
//
// Independent shift-note store (see migration 022). Reads are branch-scoped and
// calendar-day aware; writes attribute the row to the caller. Tolerant of the
// table not existing yet (returns empty) so the UI keeps rendering pre-migration.

const SELECT_COLS = "id, branch_id, created_by, created_by_name, note, created_at, updated_at"

/** TR-local midnight today as an ISO instant (used for the "today" scope). */
function todayStartIso(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString()
}

/**
 * Apply branch scope to a builder while keeping its type stable — mirrors the
 * analytics `s()` helper. Casting through a minimal `.eq` shape avoids the
 * "type instantiation excessively deep" (TS2589) error the full generic causes.
 */
function scoped<T>(query: T, scope?: BranchScope): T {
  if (!scope) return query
  type AnyEq = { eq(col: string, value: unknown): AnyEq }
  return withBranchScope(query as unknown as AnyEq, scope) as unknown as T
}

export interface CreateNoteInput {
  note:          string
  branchId?:     string | null
  createdBy:     string
  createdByName?: string | null
}

export async function createOperationNote(input: CreateNoteInput): Promise<OperationNote> {
  const supabase = createClient()
  const payload = withBranchOnInsert(
    {
      note:            input.note.trim(),
      created_by:      input.createdBy,
      created_by_name: input.createdByName ?? null,
    },
    input.branchId,
  )
  const { data, error } = await supabase
    .from("daily_operation_notes")
    .insert(payload)
    .select(SELECT_COLS)
    .single()
  if (error) throw error

  void recordAudit({
    action: "ops_note.create",
    severity: "info",
    entityType: "ops_note",
    entityId: (data as DbOperationNoteRow).id,
    meta: { note: input.note.slice(0, 120) },
  })
  return dbRowToOperationNote(data as DbOperationNoteRow)
}

/** Today's notes (calendar day). `order` "asc" for the chronological End-of-Day
 *  section; "desc" (default) for the newest-first quick panel. */
export async function listTodayOperationNotes(
  scope?: BranchScope,
  order: "asc" | "desc" = "desc",
): Promise<OperationNote[]> {
  try {
    const supabase = createClient()
    const base = scoped(supabase.from("daily_operation_notes").select(SELECT_COLS), scope)
    const { data, error } = await base
      .gte("created_at", todayStartIso())
      .order("created_at", { ascending: order === "asc" })
      .limit(200)
    if (error) throw error
    return ((data ?? []) as DbOperationNoteRow[]).map(dbRowToOperationNote)
  } catch {
    return []
  }
}

export interface ListNotesFilter {
  fromIso?: string
  toIso?:   string
  staffId?: string
  limit?:   number
}

/** Filtered history for reports (date range + optional staff). Branch-scoped. */
export async function listOperationNotes(
  filter: ListNotesFilter = {},
  scope?: BranchScope,
): Promise<OperationNote[]> {
  try {
    const supabase = createClient()
    let q = scoped(supabase.from("daily_operation_notes").select(SELECT_COLS), scope)
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? 200)
    if (filter.fromIso) q = q.gte("created_at", filter.fromIso)
    if (filter.toIso)   q = q.lte("created_at", filter.toIso)
    if (filter.staffId) q = q.eq("created_by", filter.staffId)
    const { data, error } = await q
    if (error) throw error
    return ((data ?? []) as DbOperationNoteRow[]).map(dbRowToOperationNote)
  } catch {
    return []
  }
}

export async function updateOperationNote(id: string, note: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("daily_operation_notes")
    .update({ note: note.trim() })
    .eq("id", id)
  if (error) throw error
}

export async function deleteOperationNote(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("daily_operation_notes").delete().eq("id", id)
  if (error) throw error
  void recordAudit({
    action: "ops_note.delete", severity: "warning",
    entityType: "ops_note", entityId: id,
  })
}
