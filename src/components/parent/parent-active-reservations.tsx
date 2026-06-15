"use client"

import { useEffect, useState } from "react"
import {
  Clock, Sparkles, X, AlertTriangle, KeyRound, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  listParentReservations, cancelReservation,
} from "@/lib/services/mobile-purchase.service"
import { type Reservation } from "@/types/mobile-purchase"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { createClient } from "@/lib/supabase/client"

// ─── Active Reservations ──────────────────────────────────────────────────────
//
// Surfaces the parent's PENDING reservations (not yet consumed at the venue).
// Lives at the top of the Packages screen so it's the first thing the parent
// sees after buying. Cancel button refunds wallet portion automatically.

interface Props {
  parentId: string
  /** Bumped by parent after a successful purchase so the list refreshes. */
  reloadToken: number
}

function fmtTRY(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

function fmtExpires(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return "süresi doldu"
  const d = Math.floor(diff / 86_400_000)
  if (d > 1) return `${d} gün geçerli`
  const h = Math.floor(diff / 3_600_000)
  if (h > 0) return `${h} saat içinde dolacak`
  const m = Math.max(1, Math.floor(diff / 60_000))
  return `${m} dk içinde dolacak`
}

export function ParentActiveReservations({ parentId, reloadToken }: Props) {
  const [rows, setRows] = useState<Reservation[] | null>(null)
  const [pendingCancel, setPendingCancel] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  // Initial fetch + reload-token + reconnect refresh.
  useEffect(() => {
    let cancelled = false
    void listParentReservations(parentId)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [parentId, reconnectToken, reloadToken])

  // Realtime: any change to *this parent's* reservations → refetch.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`parent-res-${parentId.slice(0, 8)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pending_reservations", filter: `parent_id=eq.${parentId}` },
        () => {
          void listParentReservations(parentId).then(setRows).catch(() => undefined)
        })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [parentId])

  async function handleCancel(id: string) {
    if (pendingCancel) return
    if (!confirm("Rezervasyonu iptal etmek istediğine emin misin? Cüzdandan ödediysen iade cüzdana yansır.")) return
    setPendingCancel(id)
    try {
      await cancelReservation(id)
      toast.success("Rezervasyon iptal edildi")
      // Refetch — also handled by realtime, but make it instant.
      const fresh = await listParentReservations(parentId)
      setRows(fresh)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İptal edilemedi")
    } finally {
      setPendingCancel(null)
    }
  }

  const pending = (rows ?? []).filter((r) => r.status === "pending")
  if (rows === null) {
    return (
      <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 h-24 animate-pulse" />
    )
  }
  if (pending.length === 0) return null

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-bold text-violet-700 dark:text-violet-300 mb-2 flex items-center gap-1.5">
        <KeyRound className="w-2.5 h-2.5" />
        Bekleyen Rezervasyonlar · {pending.length}
      </p>

      <ul className="space-y-2">
        {pending.map((r) => {
          const isUnlimited = r.durationMinutes === 0
          const cancelling = pendingCancel === r.id
          return (
            <li
              key={r.id}
              className={cn(
                "rounded-2xl border-2 border-dashed bg-gradient-to-br p-4",
                isUnlimited
                  ? "border-fuchsia-300 dark:border-fuchsia-700/60 from-fuchsia-500/[0.08] to-purple-500/[0.05]"
                  : "border-violet-300 dark:border-violet-700/60 from-violet-500/[0.08] to-purple-500/[0.05]",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-11 h-11 rounded-2xl bg-white/80 dark:bg-slate-900/70 flex items-center justify-center flex-shrink-0",
                  isUnlimited ? "text-fuchsia-600 dark:text-fuchsia-300" : "text-violet-600 dark:text-violet-300",
                )}>
                  {isUnlimited ? <Sparkles className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {isUnlimited ? "Sınırsız paket" : `${r.durationMinutes} dk paket`}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {fmtTRY(r.amount)} ödendi
                    <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>
                    {fmtExpires(r.expiresAt)}
                  </p>

                  {r.entryCode && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-violet-200/60 dark:border-violet-800/40">
                      <KeyRound className="w-3 h-3 text-violet-600 dark:text-violet-300" />
                      <span className="font-mono font-bold text-sm tracking-widest text-slate-900 dark:text-white">
                        {r.entryCode}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleCancel(r.id)}
                  disabled={cancelling}
                  aria-label="İptal et"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-500/10 disabled:opacity-40 transition-colors flex-shrink-0"
                  title="İptal et"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Expiring soon hint */}
              {(new Date(r.expiresAt).getTime() - Date.now()) < 24 * 3600_000 && (
                <div className="mt-3 pt-3 border-t border-violet-200/40 dark:border-violet-800/30 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Yakında dolacak — tesise gitmeyi unutma.</span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
