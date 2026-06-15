"use client"

import { useState, useEffect } from "react"
import { X, AlertTriangle, Wallet, Loader2, Check, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActiveSession } from "@/types/aktif-oyun"
import { elapsedMinutes } from "@/types/aktif-oyun"
import { cancelAndRefund, getSessionExtensions } from "@/lib/services/finance.service"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

const CANCEL_REASONS = [
  "Çocuk rahatsızlandı",
  "Veli isteği",
  "Acil durum",
  "Ödeme sorunu",
  "Diğer",
]

interface CancelSessionModalProps {
  session: ActiveSession
  onClose: () => void
  onCancelled: () => void
}

export function CancelSessionModal({ session, onClose, onCancelled }: CancelSessionModalProps) {
  const { user } = useAuth()
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [refundAmount, setRefundAmount] = useState<number | null>(null)
  const [estimatedRefund, setEstimatedRefund] = useState<number | null>(null)

  const elapsed = elapsedMinutes(session.entryTimestamp)
  const canCancel = elapsed <= 10

  // Note is required
  const canConfirm = !!reason && note.trim().length > 0 && canCancel

  useEffect(() => {
    if (!session.id) return
    getSessionExtensions(session.id)
      .then((exts) => {
        const extensionTotal = exts.reduce((s, e) => s + Number(e.payment_amount), 0)
        setEstimatedRefund(extensionTotal)
      })
      .catch(() => setEstimatedRefund(0))
  }, [session.id])

  async function handleConfirm() {
    if (!canConfirm) return
    setLoading(true)
    try {
      const refunded = await cancelAndRefund({
        sessionId: session.id,
        reason,
        note: note.trim(),
        refundedBy: user?.id,
      })
      setRefundAmount(refunded)
      setDone(true)
      toast.success(`${session.childName} — oturum iptal edildi${refunded > 0 ? `, ₺${refunded} iade` : ""}`)
      setTimeout(onCancelled, 1800)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Hata oluştu"
      toast.error("İptal başarısız: " + msg)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">İptal & İade</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{session.childName} · {session.parentName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Elapsed time indicator */}
          <div className={cn(
            "flex items-center gap-2 mt-4 p-3 rounded-xl",
            canCancel
              ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20"
              : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20"
          )}>
            <Clock className={cn("w-4 h-4", canCancel ? "text-amber-500" : "text-red-500")} />
            <span className={cn("text-xs font-medium", canCancel ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400")}>
              {elapsed} dk geçti
            </span>
            <span className={cn("ml-auto text-xs font-bold", canCancel ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400")}>
              {canCancel ? `${10 - elapsed} dk kaldı` : "İptal süresi doldu"}
            </span>
          </div>
        </div>

        {done ? (
          <div className="px-5 pb-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Oturum İptal Edildi</p>
            {refundAmount !== null && refundAmount > 0 ? (
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <Wallet className="w-4 h-4 text-violet-500" />
                <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
                  ₺{refundAmount.toLocaleString("tr-TR")} cüzdana aktarıldı
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">İade yapılmadı</p>
            )}
          </div>
        ) : !canCancel ? (
          <div className="px-5 pb-5">
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-center">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">İptal Süresi Doldu</p>
              <p className="text-xs text-red-600 dark:text-red-400">Oturumlar yalnızca ilk 10 dakika içinde iptal edilebilir.</p>
            </div>
            <button
              onClick={onClose}
              className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Kapat
            </button>
          </div>
        ) : (
          <>
            {/* Refund info — wallet only */}
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 p-3 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-xl">
                <Wallet className="w-4 h-4 text-violet-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">
                    {estimatedRefund !== null && estimatedRefund > 0
                      ? `₺${estimatedRefund.toLocaleString("tr-TR")} cüzdana iade edilecek`
                      : "İade tutarı hesaplanıyor..."}
                  </p>
                  <p className="text-[10px] text-violet-500 dark:text-violet-500 mt-0.5">
                    Sadece cüzdana aktarım yapılır. Nakit/kart iade yapılmaz.
                  </p>
                </div>
              </div>
            </div>

            {/* Reason selector */}
            <div className="px-5 pb-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">İptal Nedeni *</p>
              <div className="space-y-1.5">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                      reason === r
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-300"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Note — REQUIRED */}
            <div className="px-5 pb-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Personel Açıklaması <span className="text-red-500">*</span>
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="İptal detaylarını açıklayın..."
                rows={2}
                className={cn(
                  "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none transition-all",
                  note.trim().length === 0 && reason
                    ? "border-red-300 dark:border-red-500/40"
                    : "border-slate-200 dark:border-slate-700"
                )}
              />
              {note.trim().length === 0 && reason && (
                <p className="text-[10px] text-red-500 mt-1 px-1">Personel açıklaması zorunludur.</p>
              )}
            </div>

            {/* Confirm */}
            <div className="px-5 pb-5">
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || loading}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                  canConfirm && !loading
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20 active:scale-[0.98]"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                )}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                {loading ? "İşleniyor..." : "Oturumu İptal Et"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
