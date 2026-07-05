"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, X, Baby, Clock, Copy, KeyRound, Printer } from "lucide-react"
import { toast } from "sonner"
import type { ChildEntry, Customer } from "@/types/hizli-kayit"
import { DURATION_LABELS } from "@/lib/pos-data"
import {
  getOrCreateEntryCode,
  generateClientSideCode,
} from "@/lib/services/entry-code.service"
import { PrintButtons } from "./print-buttons"

interface SuccessModalProps {
  customer: Customer
  kidsList: ChildEntry[]
  total: number
  /** Server-assigned daily label numbers, one per child in kidsList order. */
  labelNumbers?: string[]
  onClose: () => void
}

// ─── Success Modal ───────────────────────────────────────────────────────────
//
// After a successful registration the customer's permanent entry code is the
// *primary* artefact — the cashier reads it aloud (or prints it on the receipt)
// so the parent can return next time without ever giving their name again.
// The rest of the modal (children list, total) is secondary context.

export function SuccessModal({ customer, kidsList, total, labelNumbers, onClose }: SuccessModalProps) {
  const [code, setCode] = useState<string>("")
  const [codeIsFallback, setCodeIsFallback] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getOrCreateEntryCode(customer.id)
      .then((c) => { if (!cancelled) { setCode(c); setCodeIsFallback(false) } })
      .catch(() => {
        // Migration 008 not applied yet → graceful client-side fallback so the
        // demo still shows a code shaped exactly like the real one.
        if (!cancelled) {
          setCode(generateClientSideCode())
          setCodeIsFallback(true)
        }
      })
    return () => { cancelled = true }
  }, [customer.id])

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      toast.success("Kod kopyalandı")
    } catch {
      toast.error("Kod kopyalanamadı")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header — order per operator request: phone → child(ren) → parent */}
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-5 text-white text-center">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2 animate-in zoom-in duration-300 delay-100">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold">Giriş Başarılı</h2>
          <div className="mt-1 space-y-0.5 text-emerald-50 text-[13px]">
            {customer.phone && <p className="tabular-nums font-semibold">{customer.phone}</p>}
            <p className="font-bold">
              {kidsList.map((c) => c.name).filter(Boolean).join(", ") || "—"}
            </p>
            <p className="text-emerald-100/85 text-xs">Veli: {customer.name}</p>
          </div>
        </div>

        {/* PRIMARY: Entry code */}
        <div className="px-5 pt-5">
          <div className="rounded-2xl border-2 border-dashed border-violet-300 dark:border-violet-700/60 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-500/[0.08] dark:to-fuchsia-500/[0.06] p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-violet-700 dark:text-violet-300 mb-1.5">
              <KeyRound className="w-3 h-3" />
              <span>Müşteri Kodu</span>
              {codeIsFallback && <span className="text-amber-600 dark:text-amber-400 normal-case tracking-normal opacity-70 ml-1">(demo)</span>}
            </div>

            <button
              type="button"
              onClick={copyCode}
              disabled={!code}
              className="w-full flex items-center justify-between gap-3 group disabled:opacity-50"
            >
              <span className="font-mono font-black tracking-widest text-2xl text-slate-900 dark:text-white">
                {code || "..."}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 opacity-60 group-hover:opacity-100 transition-opacity">
                <Copy className="w-3 h-3" />
                Kopyala
              </span>
            </button>

            <p className="text-[11px] text-violet-700/70 dark:text-violet-300/70 mt-2 leading-snug">
              Bu kodu veliye söyle — sonraki gelişinde isim sormaya gerek kalmadan
              hızlı kayıt ekranına yazılır.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          {/* Children — secondary. Each shows its atomic daily label number. */}
          <div className="space-y-1.5">
            {kidsList.map((child, i) => {
              const labelNo = labelNumbers?.[i]?.trim()
              return (
                <div key={child.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                  {labelNo ? (
                    <span
                      className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center flex-shrink-0 text-xs font-black tabular-nums"
                      title="Günlük etiket sırası"
                    >
                      {labelNo}
                    </span>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                      <Baby className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{child.name}</p>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{child.duration ? DURATION_LABELS[child.duration] : "—"}</span>
                      {labelNo && <span className="text-violet-500 font-semibold">· Sıra #{labelNo}</span>}
                    </div>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    ₺{child.price}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-sm text-slate-500">Toplam</span>
            <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              ₺{total.toLocaleString("tr-TR")}
            </span>
          </div>

          {/* Label printing — XPrinter XP-470B */}
          <div className="pt-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1.5">
              <Printer className="w-3 h-3" />
              Etiket Yazdır
            </div>
            <PrintButtons
              customer={customer}
              kidsList={kidsList}
              sessionNumber={code || "—"}
              labelNumbers={labelNumbers}
            />
          </div>

          {/* Actions */}
          <div className="pt-1">
            <button
              onClick={onClose}
              className="w-full min-h-[44px] py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Yeni Kayıt
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Kapat"
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  )
}
