"use client"

import { useState } from "react"
import { AlertTriangle, ArrowDownLeft, Wallet, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { FinTransaction } from "@/types/cuzdan"

const CANCEL_REASONS = [
  "Çocuk hastalandı",
  "Acil durum",
  "Müşteri vazgeçti",
  "Çift rezervasyon",
  "Kapasite hatası",
  "Diğer",
]

interface RefundModalProps {
  transaction: FinTransaction | null
  onClose: () => void
}

export function RefundModal({ transaction, onClose }: RefundModalProps) {
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)

  if (!transaction) return null

  function handleConfirm() {
    setConfirmed(true)
    setTimeout(() => {
      setConfirmed(false)
      setReason("")
      setNote("")
      onClose()
    }, 1800)
  }

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <DialogTitle>İptal & Cüzdan İadesi</DialogTitle>
          </div>
        </DialogHeader>

        {confirmed ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Wallet className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">İade Tamamlandı</p>
            <p className="text-xs text-slate-500">₺{transaction.amount.toLocaleString("tr-TR")} müşterinin cüzdanına aktarıldı</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Transaction info */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Müşteri</span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">{transaction.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Hizmet</span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">{transaction.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Tutar</span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">₺{transaction.amount.toLocaleString("tr-TR")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Zaman</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">{transaction.datetime}</span>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">İade Kuralları</p>
                <ul className="text-[10px] text-amber-600 dark:text-amber-500 mt-1 space-y-0.5">
                  <li>• Nakit iade yapılmaz</li>
                  <li>• İade yalnızca cüzdana aktarılır</li>
                  <li>• İlk 10 dakika içinde iptal edilebilir</li>
                </ul>
              </div>
            </div>

            {/* Cancel reason */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                İptal Nedeni <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors border",
                      reason === r
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-300"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Staff note */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                Personel Notu
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Açıklama ekle (isteğe bağlı)..."
                rows={2}
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            {/* Refund destination */}
            <div className="flex items-center gap-3 p-3 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-xl">
              <Wallet className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">Cüzdana Aktarılacak</p>
                <p className="text-[10px] text-violet-600 dark:text-violet-500">{transaction.customerName} cüzdanına</p>
              </div>
              <p className="text-sm font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                ₺{transaction.amount.toLocaleString("tr-TR")}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors"
              >
                <X className="w-4 h-4" />
                Vazgeç
              </button>
              <button
                onClick={handleConfirm}
                disabled={!reason}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                  reason
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                )}
              >
                <ArrowDownLeft className="w-4 h-4" />
                İptal Et & İade Al
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
