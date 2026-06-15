"use client"

import { useEffect, useState } from "react"
import { Users, Square, Activity, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { listTodayStaff, endShift } from "@/lib/services/staff-shift.service"
import {
  type StaffShiftTodayRow,
  formatDuration, formatRelativeShort,
} from "@/types/staff-shift"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { useAuth } from "@/contexts/auth-context"
import { isSuperAdmin } from "@/types/auth"
import { EmptyState } from "@/components/system/empty-state"

// ─── ActiveStaffPanel ─────────────────────────────────────────────────────────
//
// Manager-facing live roster: who's on shift right now, when they started,
// last action time, action + refund count, and a quick "force-end" button
// for forgotten clock-outs.

function initials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? "?"
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

const PALETTE = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
]

export function ActiveStaffPanel() {
  const { user } = useAuth()
  const [rows, setRows] = useState<StaffShiftTodayRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  const canForceEnd = !!user && ["super_admin", "admin", "manager"].includes(user.role)

  useEffect(() => {
    let cancelled = false
    setError(null)
    void listTodayStaff()
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    // Poll every 20s for live "last action" updates.
    const id = setInterval(() => {
      void listTodayStaff()
        .then((r) => { if (!cancelled) setRows(r) })
        .catch(() => undefined)
    }, 20_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [reconnectToken])

  async function handleForceEnd(row: StaffShiftTodayRow) {
    if (!confirm(`${row.staffName ?? "Bu personelin"} vardiyasını bitirmek istediğine emin misin?`)) return
    try {
      await endShift(row.userId, `Yönetici tarafından bitirildi`)
      toast.success("Vardiya bitirildi")
      const fresh = await listTodayStaff()
      setRows(fresh)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bitirilemedi")
    }
  }

  const active = (rows ?? []).filter((r) => r.status === "active")
  const ended  = (rows ?? []).filter((r) => r.status === "ended")

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Users className="w-3.5 h-3.5 text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aktif Personeller</h3>
        <span className="text-[11px] text-slate-400 ml-auto">
          {active.length} aktif · {ended.length} kapalı
        </span>
      </div>

      {error ? (
        <EmptyState title="Personel verisi okunamadı" body={error} tone="danger" />
      ) : rows === null ? (
        <div className="p-6 space-y-2 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Bugün açık vardiya yok" body="Personel vardiyasını başlattığında burada görünecek." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {[...active, ...ended].map((row, i) => {
            const isActive = row.status === "active"
            return (
              <li key={row.shiftId} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <div className="relative flex-shrink-0">
                  <div className={cn(
                    "w-10 h-10 rounded-xl bg-gradient-to-br text-white text-xs font-bold flex items-center justify-center",
                    PALETTE[i % PALETTE.length],
                  )}>
                    {initials(row.staffName)}
                  </div>
                  <span className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900",
                    isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400",
                  )} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {row.staffName ?? "—"}
                    </p>
                    {row.staffRole && (
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">{row.staffRole}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      {isActive
                        ? `${formatDuration(Math.floor((Date.now() - new Date(row.startedAt).getTime())/1000))} çalışıyor`
                        : `${formatDuration(row.durationSeconds)} sürdü`}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="flex items-center gap-0.5">
                      <Activity className="w-2.5 h-2.5" />
                      {row.actionCount} işlem
                    </span>
                    {row.refundCount > 0 && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-semibold">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {row.refundCount} iade
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Son işlem</p>
                  <p className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                    {formatRelativeShort(row.lastActionAt)}
                  </p>
                </div>

                {isActive && canForceEnd && (
                  <button
                    type="button"
                    onClick={() => handleForceEnd(row)}
                    title="Vardiyayı zorla bitir"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
