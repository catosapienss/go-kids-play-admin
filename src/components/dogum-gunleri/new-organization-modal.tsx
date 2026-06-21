"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Cake, Loader2, Check, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { createOrganization } from "@/lib/services/organizations.service"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface Pkg {
  id: string
  name: string
  price: number
  is_active: boolean
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

interface Form {
  childName: string
  childAge: string
  parentName: string
  parentPhone: string
  packageId: string
  eventDate: string
  eventTime: string
  guestCount: string
  notes: string
}

const EMPTY: Form = {
  childName: "", childAge: "", parentName: "", parentPhone: "",
  packageId: "", eventDate: "", eventTime: "", guestCount: "", notes: "",
}

export function NewOrganizationModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<Form>(EMPTY)
  const [pkgs, setPkgs] = useState<Pkg[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load active packages so the operator can pick one.
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("birthday_packages")
      .select("id, name, price, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setPkgs((data ?? []) as Pkg[]))
  }, [])

  const selectedPkg = pkgs.find((p) => p.id === form.packageId) ?? null
  const inferredPrice = selectedPkg?.price ?? 0

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  async function submit() {
    if (!form.childName.trim())   return setError("Çocuk adı zorunlu")
    if (!form.parentName.trim())  return setError("Veli adı zorunlu")
    if (!form.eventDate)          return setError("Etkinlik tarihi zorunlu")

    setBusy(true)
    try {
      await createOrganization({
        child_name:   form.childName.trim(),
        child_age:    form.childAge ? Number(form.childAge) : null,
        parent_name:  form.parentName.trim(),
        parent_phone: form.parentPhone.trim() || null,
        package_id:   form.packageId || null,
        event_date:   form.eventDate,
        event_time:   form.eventTime || null,
        guest_count:  form.guestCount ? Number(form.guestCount) : 0,
        total_price:  inferredPrice,
        notes:        form.notes.trim() || null,
      })
      toast.success("Doğum günü rezervasyonu oluşturuldu")
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 200) : "Kaydedilemedi")
    } finally {
      setBusy(false)
    }
  }

  // Render via Portal into <body> so any parent stacking context (transform,
  // overflow, z-index) cannot accidentally hide the modal — early bug had the
  // modal opening at z-index below the sidebar shell, making the click look
  // like a no-op.
  if (typeof document === "undefined") return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9000] flex items-center justify-center px-4 py-8 bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Cake className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Yeni Doğum Günü</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Rezervasyon oluştur</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Child */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Çocuk Adı *" value={form.childName} onChange={(v) => update("childName", v)} placeholder="Örn. Defne" />
            <Field label="Yaş" type="number" value={form.childAge} onChange={(v) => update("childAge", v)} placeholder="6" />
          </div>

          {/* Parent */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Veli Adı *" value={form.parentName} onChange={(v) => update("parentName", v)} placeholder="Örn. Ayşe Hanım" />
            <Field label="Telefon" type="tel" value={form.parentPhone} onChange={(v) => update("parentPhone", v)} placeholder="0532 ..." />
          </div>

          {/* Date / Time / Guests */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tarih *" type="date" value={form.eventDate} onChange={(v) => update("eventDate", v)} />
            <Field label="Saat" type="time" value={form.eventTime} onChange={(v) => update("eventTime", v)} />
            <Field label="Misafir" type="number" value={form.guestCount} onChange={(v) => update("guestCount", v)} placeholder="0" />
          </div>

          {/* Package */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">
              Paket
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {pkgs.length === 0 && (
                <p className="col-span-3 text-xs text-slate-400 py-2">
                  Aktif paket yok. /dogum-gunleri Paketler kartından eklenebilir.
                </p>
              )}
              {pkgs.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => update("packageId", p.id)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-2 text-left transition-all",
                    form.packageId === p.id
                      ? "border-pink-500 bg-pink-50 dark:bg-pink-500/10 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 hover:border-pink-300 dark:hover:border-pink-500/40",
                  )}
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{p.name}</p>
                  <p className="text-[10px] text-slate-500">₺{p.price.toLocaleString("tr-TR")}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
              Not
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Tema, alerji, özel istek..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none focus:outline-none focus:border-pink-500"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {selectedPkg && (
            <div className="rounded-xl border border-pink-200 dark:border-pink-500/30 bg-pink-50/50 dark:bg-pink-500/[0.04] p-3 text-xs text-pink-700 dark:text-pink-300 flex items-center justify-between">
              <span>{selectedPkg.name} seçildi</span>
              <span className="font-bold tabular-nums">₺{selectedPkg.price.toLocaleString("tr-TR")}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30">
          <button onClick={onClose} disabled={busy} className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white">
            Vazgeç
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={cn(
              "text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition-all",
              busy
                ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-lg shadow-pink-500/20",
            )}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {busy ? "Kaydediliyor…" : "Rezervasyonu Oluştur"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-pink-500"
      />
    </div>
  )
}
