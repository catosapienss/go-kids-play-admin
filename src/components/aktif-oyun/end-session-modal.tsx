"use client"

import { useState } from "react"
import { X, Loader2, LogOut, AlertTriangle, UserCheck, Baby, ShieldAlert, MoreHorizontal, MessageSquare } from "lucide-react"
import type { ActiveSession } from "@/types/aktif-oyun"
import { END_REASON_LABELS, MANUAL_END_REASONS, type EndReason } from "@/lib/services/session.service"
import { cn } from "@/lib/utils"

// ─── End Session Modal ───────────────────────────────────────────────────────
//
// Production-grade termination dialog. Forces the operator to pick a reason
// before sending the end_session_with_reason RPC. Optional free-text note.
// Closing without confirming leaves the session untouched.

interface Props {
  session: ActiveSession
  onClose: () => void
  onConfirm: (reason: EndReason, note: string | undefined) => Promise<void> | void
}

const REASON_ICONS: Record<EndReason, { icon: React.ReactNode; tone: string }> = {
  time_expired:        { icon: <LogOut       className="w-4 h-4" />, tone: "from-emerald-500 to-green-600" },
  manual_exit:         { icon: <LogOut       className="w-4 h-4" />, tone: "from-slate-500 to-slate-700" },
  customer_left_early: { icon: <LogOut       className="w-4 h-4" />, tone: "from-amber-500 to-orange-500" },
  parent_request:      { icon: <UserCheck    className="w-4 h-4" />, tone: "from-sky-500 to-blue-500" },
  child_request:       { icon: <Baby         className="w-4 h-4" />, tone: "from-pink-500 to-rose-500" },
  emergency:           { icon: <ShieldAlert  className="w-4 h-4" />, tone: "from-rose-500 to-red-600" },
  staff_decision:      { icon: <AlertTriangle className="w-4 h-4" />, tone: "from-violet-500 to-purple-600" },
  other:               { icon: <MoreHorizontal className="w-4 h-4" />, tone: "from-slate-500 to-slate-700" },
}

const REASON_OPTIONS = MANUAL_END_REASONS.map((key) => ({ key, ...REASON_ICONS[key] }))

export function EndSessionModal({ session, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState<EndReason | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!reason || busy) return
    setBusy(true)
    try {
      await onConfirm(reason, note.trim() || undefined)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9000] flex items-center justify-center px-4 py-8 bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Oyunu Sonlandır</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {session.childName} · {session.parentName}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reason grid */}
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
              Sebep <span className="text-rose-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setReason(opt.key)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-all",
                    reason === opt.key
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-500/40",
                  )}
                >
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${opt.tone} flex items-center justify-center text-white flex-shrink-0`}>
                    {opt.icon}
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                    {END_REASON_LABELS[opt.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional note */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />
              Not (opsiyonel)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Detay eklemek istersen yaz…"
              rows={2}
              maxLength={300}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none focus:outline-none focus:border-violet-500"
            />
            <p className="text-[10px] text-slate-400 mt-1 text-right">{note.length}/300</p>
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2.5 text-[11px] text-amber-700 dark:text-amber-200">
            ⓘ Oturumu sonlandırmak otomatik iade oluşturmaz. İade gerekiyorsa ayrıca işlem yapın.
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            Vazgeç
          </button>
          <button
            onClick={confirm}
            disabled={!reason || busy}
            className={cn(
              "text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition-all",
              !reason || busy
                ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white shadow-lg shadow-rose-500/20",
            )}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            {busy ? "Sonlandırılıyor…" : "Oyunu Sonlandır"}
          </button>
        </div>
      </div>
    </div>
  )
}
