"use client"

import { useEffect, useState } from "react"
import { Users, Banknote, CreditCard, Loader2 } from "lucide-react"
import { listStaffClosings, type StaffClosingRow } from "@/lib/services/cash-register.service"
import { EmptyState } from "@/components/system/empty-state"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"

// ─── Staff Day-End Handovers ──────────────────────────────────────────────────
//
// Manager/owner view: staff (personel) day-end submissions so EVERY authorized
// user's closing is visible in the panel — not just manager/admin register
// closings. Reads the existing "staff.day.closing" audit records (read-only).

function fmtTRY(n: number): string {
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  } catch { return iso }
}

export function StaffClosingHistory() {
  const [rows, setRows] = useState<StaffClosingRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setRows(null); setError(null)
    void listStaffClosings(40)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Veri çekilemedi") })
    return () => { cancelled = true }
  }, [reconnectToken])

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Users className="w-3.5 h-3.5 text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Personel Gün Sonu Teslimleri</h3>
        <span className="text-[10px] text-slate-400 ml-auto tabular-nums">{rows?.length ?? 0} kayıt</span>
      </div>

      {rows === null && !error ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
      ) : error ? (
        <EmptyState title="Okunamadı" body={error} tone="danger" />
      ) : rows && rows.length === 0 ? (
        <EmptyState title="Henüz personel teslimi yok" body="Personel gün sonu gönderdiğinde burada görünecek." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="px-5 py-3 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {(r.submittedByName || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.submittedByName}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{fmtDateTime(r.submittedAt)}</p>
                {r.notes && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{r.notes}</p>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 tabular-nums">
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                  <Banknote className="w-3.5 h-3.5" />{fmtTRY(r.cash)}
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-sky-600 dark:text-sky-400">
                  <CreditCard className="w-3.5 h-3.5" />{fmtTRY(r.posZ)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
