"use client"

import { useState } from "react"
import { Banknote, CreditCard, FileSignature, CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { recordAudit } from "@/lib/reliability/audit-log"

// ─── Staff Day-End Closing Form ───────────────────────────────────────────────
//
// Simplified form for staff (personel) role. Collects:
//   1. Physical cash in register
//   2. POS Z-report total
//   3. Optional note
//
// Saves as an audit record (action = "staff.day.closing") so managers can
// review all submissions in the audit log view.

interface StaffClosingData {
  cashCount: number
  posZReport: number
  notes: string
  submittedAt: string
  submittedByName: string
  submittedById: string
}

interface Props {
  onSubmitted?: (data: StaffClosingData) => void
}

export function StaffClosingForm({ onSubmitted }: Props) {
  const { user } = useAuth()
  const [cashCount, setCashCount] = useState("")
  const [posZ, setPosZ] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<StaffClosingData | null>(null)

  async function handleSubmit() {
    const cash = parseFloat(cashCount.replace(",", ".")) || 0
    const pos  = parseFloat(posZ.replace(",", "."))  || 0

    if (!cashCount.trim()) {
      toast.warning("Nakit kasa tutarını giriniz")
      return
    }
    if (!posZ.trim()) {
      toast.warning("POS Z-raporu tutarını giriniz")
      return
    }

    setSubmitting(true)
    try {
      const submittedAt = new Date().toISOString()
      const data: StaffClosingData = {
        cashCount: cash,
        posZReport: pos,
        notes: notes.trim(),
        submittedAt,
        submittedByName: user?.fullName ?? "Bilinmiyor",
        submittedById: user?.id ?? "",
      }

      await recordAudit({
        action: "staff.day.closing",
        severity: "info",
        entityType: "staff_closing",
        meta: {
          cash_count:    cash,
          pos_z_report:  pos,
          notes:         notes.trim(),
          submitted_by:  user?.fullName ?? "",
          submitted_by_id: user?.id ?? "",
          business_date: new Date().toISOString().slice(0, 10),
        },
      })

      setSubmitted(data)
      toast.success("Gün sonu kaydedildi", {
        description: `Nakit: ₺${fmt(cash)} · POS: ₺${fmt(pos)}`,
      })
      onSubmitted?.(data)
    } catch (e) {
      toast.error("Kayıt gönderilemedi", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-6 py-5 bg-emerald-50/60 dark:bg-emerald-500/[0.06] border-b border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Gün Sonu Teslim Edildi</h2>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
              {new Date(submitted.submittedAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-900/40 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">Nakit Kasa</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">₺{fmt(submitted.cashCount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-900/40 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">POS Z-Raporu</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">₺{fmt(submitted.posZReport)}</p>
          </div>
        </div>
        {submitted.notes && (
          <div className="px-6 pb-5 -mt-1">
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">Not</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              {submitted.notes}
            </p>
          </div>
        )}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500">
          <Lock className="w-3 h-3" />
          Yöneticiniz bu kaydı görebilir. İyi akşamlar, {submitted.submittedByName.split(" ")[0]}!
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Gün Sonu Kapanış
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Kasayı say · POS raporunu gir · gönder
        </p>
      </div>

      <div className="p-6 space-y-5">
        {/* Cash count */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            <Banknote className="w-3.5 h-3.5" />
            Nakit Kasa Tutarı
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₺</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cashCount}
              onChange={(e) => setCashCount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-7 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-lg font-semibold tabular-nums outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Kasadaki tüm nakit parayı sayarak girin</p>
        </div>

        {/* POS Z-report */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            <CreditCard className="w-3.5 h-3.5" />
            POS Z-Raporu Toplamı
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₺</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={posZ}
              onChange={(e) => setPosZ(e.target.value)}
              placeholder="0.00"
              className="w-full pl-7 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-lg font-semibold tabular-nums outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">POS cihazından Z-raporu alarak yazılan toplamı girin</p>
        </div>

        {/* Notes */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            <FileSignature className="w-3.5 h-3.5" />
            Not <span className="text-slate-400 normal-case tracking-normal font-normal">(isteğe bağlı)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Bugüne ait önemli bir bilgi varsa buraya yazabilirsin…"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            "w-full min-h-[48px] px-5 rounded-xl font-bold text-sm text-white transition-colors flex items-center justify-center gap-2",
            submitting
              ? "bg-violet-400 cursor-not-allowed"
              : "bg-violet-600 hover:bg-violet-700",
          )}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Gönderiliyor…</>
          ) : (
            <><CheckCircle2 className="w-4 h-4" /> Kapanışı Tamamla</>
          )}
        </button>
        <p className="text-center text-[11px] text-slate-400 mt-2">
          Bu işlem yöneticinize iletilecektir
        </p>
      </div>
    </div>
  )
}

function fmt(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
