"use client"

import { useState } from "react"
import { Play, Square, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useShiftStatus } from "@/hooks/use-shift-status"

// ─── Shift Clock Card ─────────────────────────────────────────────────────────
//
// The cashier's first interaction every shift: a single large, decisive
// "Vardiyaya Başla" / "Vardiyayı Bitir" affordance with live elapsed time.
//
// Three states:
//   • idle      → no active shift → big purple "Başla" button
//   • on-clock  → live timer + red "Bitir" button + start-time reminder
//   • loading   → optimistic spinner
//
// Designed to be droppable anywhere: top of /hizli-kayit, top of /personeller,
// inside a sidebar widget. No padding assumptions.

function fmtElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function fmtStartTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  } catch { return "" }
}

interface Props {
  /** Compact mode shrinks paddings — for sidebar widgets. */
  compact?: boolean
  className?: string
}

export function ShiftClockCard({ compact, className }: Props) {
  const { user } = useAuth()
  const { shift, isActive, elapsedSeconds, isLoading, start, end } = useShiftStatus()
  const [busy, setBusy] = useState(false)

  async function handleStart() {
    if (busy) return
    setBusy(true)
    try {
      await start()
      toast.success("Vardiya başladı")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vardiya başlatılamadı")
    } finally { setBusy(false) }
  }

  async function handleEnd() {
    if (busy) return
    if (!confirm("Vardiyayı bitirmek istediğine emin misin?")) return
    setBusy(true)
    try {
      await end()
      toast.success("Vardiya tamamlandı")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vardiya bitirilemedi")
    } finally { setBusy(false) }
  }

  if (isLoading && !shift) {
    return (
      <div className={cn(
        "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center",
        compact ? "p-4 min-h-[80px]" : "p-6 min-h-[120px]",
        className,
      )}>
        <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
      </div>
    )
  }

  // ── On the clock ───────────────────────────────────────────────────────────
  if (isActive && shift) {
    return (
      <div className={cn(
        "relative rounded-2xl overflow-hidden border bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/[0.10] dark:to-teal-500/[0.06] border-emerald-300 dark:border-emerald-700/50",
        compact ? "p-3" : "p-5",
        className,
      )}>
        <div className={cn("flex items-center", compact ? "gap-3" : "gap-4")}>
          <div className={cn(
            "rounded-2xl flex items-center justify-center text-white flex-shrink-0 relative",
            compact ? "w-10 h-10" : "w-14 h-14",
            "bg-emerald-500",
          )}>
            <CheckCircle2 className={compact ? "w-5 h-5" : "w-6 h-6"} />
            <span className="absolute inset-0 rounded-2xl ring-2 ring-emerald-400/50 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "font-bold text-emerald-900 dark:text-emerald-100",
                compact ? "text-xs uppercase tracking-wider" : "text-sm uppercase tracking-wider",
              )}>
                Vardiya Aktif
              </span>
              <span className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">
                · {fmtStartTime(shift.startedAt)}'dan beri
              </span>
            </div>
            <div className={cn(
              "font-black tabular-nums text-emerald-700 dark:text-emerald-300 leading-none mt-0.5",
              compact ? "text-2xl" : "text-4xl",
            )}>
              {fmtElapsed(elapsedSeconds)}
            </div>
            {!compact && user?.fullName && (
              <p className="text-[11px] text-emerald-700/70 dark:text-emerald-300/70 mt-1">
                {user.fullName}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleEnd}
            disabled={busy}
            className={cn(
              "rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0",
              compact ? "min-h-[40px] px-3 text-xs" : "min-h-[48px] px-4 text-sm",
            )}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
            Bitir
          </button>
        </div>
      </div>
    )
  }

  // ── Idle state — no active shift ───────────────────────────────────────────
  return (
    <div className={cn(
      "rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
      compact ? "p-3" : "p-5",
      className,
    )}>
      <div className={cn("flex items-center", compact ? "gap-3" : "gap-4")}>
        <div className={cn(
          "rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex-shrink-0",
          compact ? "w-10 h-10" : "w-14 h-14",
        )}>
          <Clock className={compact ? "w-5 h-5" : "w-6 h-6"} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-bold text-slate-700 dark:text-slate-200",
            compact ? "text-xs uppercase tracking-wider" : "text-sm uppercase tracking-wider",
          )}>
            Vardiya Bekliyor
          </p>
          <p className={cn(
            "text-slate-500 dark:text-slate-400 mt-0.5",
            compact ? "text-[11px]" : "text-sm",
          )}>
            Operasyona başlamak için vardiyaya başla.
          </p>
        </div>
        <button
          type="button"
          onClick={handleStart}
          disabled={busy}
          className={cn(
            "rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0 shadow-lg shadow-violet-500/25",
            compact ? "min-h-[40px] px-3 text-xs" : "min-h-[48px] px-5 text-sm",
          )}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {compact ? "Başla" : "Vardiyaya Başla"}
        </button>
      </div>
    </div>
  )
}
