"use client"

import { useEffect, useState } from "react"
import { Sparkles, CreditCard, Ticket, Clock, X, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { createMembership } from "@/lib/services/membership.service"
import {
  TYPE_LABEL, TYPE_TONE, type MembershipType,
} from "@/types/membership"
import { CustomerSearchPalette } from "@/components/crm/customer-search-palette"
import type { CustomerSummary } from "@/types/customer"

// ─── MembershipCreateDialog ───────────────────────────────────────────────────
//
// 3-step admin dialog for opening a new membership:
//   1. Customer pick (uses the existing CustomerSearchPalette)
//   2. Type pick   (unlimited / monthly / punch_pass / timed)
//   3. Parameters  (duration, total_uses, notes) → submit
//
// Modelled as a single modal with stepwise back/forward so the admin never
// loses context.

type Step = "customer" | "type" | "params"

const TYPE_ICON: Record<MembershipType, typeof Sparkles> = {
  unlimited:  Sparkles,
  monthly:    CreditCard,
  punch_pass: Ticket,
  timed:      Clock,
}

const TYPE_BLURB: Record<MembershipType, string> = {
  unlimited:  "Sınırsız giriş · duraklatılabilir",
  monthly:    "Aylık abonelik · sınırsız giriş",
  punch_pass: "Kontörlü paket · belirli giriş hakkı",
  timed:      "Süreli paket · belirli bir tarihe kadar",
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function MembershipCreateDialog({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>("customer")
  const [customer, setCustomer] = useState<CustomerSummary | null>(null)
  const [type, setType] = useState<MembershipType>("unlimited")
  const [durationDays, setDurationDays] = useState(30)
  const [totalUses, setTotalUses] = useState(10)
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep("customer"); setCustomer(null)
    setType("unlimited"); setDurationDays(30); setTotalUses(10); setNotes("")
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  async function submit() {
    if (!customer || busy) return
    setBusy(true)
    try {
      await createMembership({
        parentId:     customer.id,
        type,
        durationDays: type === "punch_pass" ? undefined : durationDays,
        totalUses:    type === "punch_pass" ? totalUses : undefined,
        notes:        notes.trim() || undefined,
      })
      toast.success("Üyelik oluşturuldu")
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Üyelik oluşturulamadı")
    } finally { setBusy(false) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white flex-1">
            {step === "customer" ? "Müşteri seç"
             : step === "type"   ? "Üyelik türü"
             : "Üyelik ayarları"}
          </p>
          <StepDots step={step} />
          <button type="button" onClick={onClose} aria-label="Kapat" className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === "customer" && (
            <CustomerSearchPalette
              autoFocus
              onSelect={(c) => { setCustomer(c); setStep("type") }}
              className="h-[60vh]"
            />
          )}

          {step === "type" && customer && (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Müşteri</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{customer.fullName}</p>
                <p className="text-[11px] text-slate-500">{customer.phone}</p>
              </div>

              {(["unlimited", "monthly", "punch_pass", "timed"] as MembershipType[]).map((t) => {
                const Icon = TYPE_ICON[t]
                const tone = TYPE_TONE[t]
                const isActive = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "w-full rounded-2xl border-2 p-4 flex items-center gap-3 text-left transition-colors",
                      isActive
                        ? "border-violet-500 bg-violet-50/60 dark:bg-violet-500/[0.08]"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
                    )}
                  >
                    <div className={cn("w-11 h-11 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center flex-shrink-0", tone.gradient)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-900 dark:text-white">{TYPE_LABEL[t]}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{TYPE_BLURB[t]}</p>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
                  </button>
                )
              })}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setStep("customer")} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Geri</button>
                <button type="button" onClick={() => setStep("params")} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">Devam</button>
              </div>
            </div>
          )}

          {step === "params" && customer && (
            <div className="space-y-4">
              {type !== "punch_pass" ? (
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                    Süre (gün)
                  </label>
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {[7, 14, 30, 60, 90, 365].map((d) => (
                      <button
                        key={d} type="button"
                        onClick={() => setDurationDays(d)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-xs font-bold border transition-colors",
                          durationDays === d
                            ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-300"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
                        )}
                      >
                        {d} gün
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      value={durationDays}
                      onChange={(e) => setDurationDays(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                    Kullanım hakkı sayısı
                  </label>
                  <div className="flex items-center gap-1 mt-2">
                    {[5, 10, 20, 30].map((n) => (
                      <button
                        key={n} type="button"
                        onClick={() => setTotalUses(n)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-xs font-bold border transition-colors",
                          totalUses === n
                            ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-300"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      value={totalUses}
                      onChange={(e) => setTotalUses(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                  Not (opsiyonel)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Yaz kampı, hediye, vs."
                  className="w-full mt-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setStep("type")} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Geri</button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                  Üyeliği Oluştur
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["customer", "type", "params"]
  const idx = order.indexOf(step)
  return (
    <div className="flex items-center gap-1">
      {order.map((s, i) => (
        <span key={s} className={cn("h-1 rounded-full transition-all", i === idx ? "w-5 bg-violet-500" : i < idx ? "w-2 bg-violet-300 dark:bg-violet-700" : "w-2 bg-slate-200 dark:bg-slate-700")} />
      ))}
    </div>
  )
}
