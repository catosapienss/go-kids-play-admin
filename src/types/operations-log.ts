// ─── Daily Operations Log (Shift Notes) ──────────────────────────────────────
//
// A per-day operational log independent of customer data. See migration 022.

export interface OperationNote {
  id:            string
  branchId:      string | null
  createdBy:     string | null
  createdByName: string | null
  note:          string
  createdAt:     string      // ISO — auto captured
  updatedAt:     string
}

export interface DbOperationNoteRow {
  id:              string
  branch_id:       string | null
  created_by:      string | null
  created_by_name: string | null
  note:            string
  created_at:      string
  updated_at:      string
}

export function dbRowToOperationNote(r: DbOperationNoteRow): OperationNote {
  return {
    id:            r.id,
    branchId:      r.branch_id,
    createdBy:     r.created_by,
    createdByName: r.created_by_name,
    note:          r.note,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  }
}
