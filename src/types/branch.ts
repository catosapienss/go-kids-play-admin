// ─── Branch / Tenant types ────────────────────────────────────────────────────

export type BranchStatus = "active" | "paused" | "archived"

export interface Branch {
  id: string
  branchName: string
  branchCode: string
  address?: string
  phone?: string
  status: BranchStatus
  tenantId?: string
  subdomain?: string
  createdAt: string
}

/** Raw DB row shape (snake_case) — only used inside the service layer. */
export interface DbBranchRow {
  id: string
  branch_name: string
  branch_code: string
  address: string | null
  phone: string | null
  status: BranchStatus
  tenant_id: string | null
  subdomain: string | null
  created_at: string
}

export function dbRowToBranch(r: DbBranchRow): Branch {
  return {
    id: r.id,
    branchName: r.branch_name,
    branchCode: r.branch_code,
    address: r.address ?? undefined,
    phone: r.phone ?? undefined,
    status: r.status,
    tenantId: r.tenant_id ?? undefined,
    subdomain: r.subdomain ?? undefined,
    createdAt: r.created_at,
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export const BRANCH_STATUS_LABEL: Record<BranchStatus, string> = {
  active:   "Aktif",
  paused:   "Duraklatıldı",
  archived: "Arşivlendi",
}

export const BRANCH_STATUS_TONE: Record<BranchStatus, string> = {
  active:   "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paused:   "bg-amber-500/10   text-amber-700   dark:text-amber-300",
  archived: "bg-slate-500/10   text-slate-700   dark:text-slate-300",
}
