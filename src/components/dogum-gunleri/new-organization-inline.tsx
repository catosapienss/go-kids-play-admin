"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Cake, Loader2, Check, AlertCircle, CalendarDays, Users, Gift, Info } from "lucide-react"
import { toast } from "sonner"
import {
  createOrganization, addOrgPayment,
  listActiveBirthdayPackages, computePrice, isWeekendDate, includedCapacity,
  type BirthdayPackage, type OrgPaymentMethod,
} from "@/lib/services/organizations.service"
import { cn } from "@/lib/utils"

// ─── Inline Yeni Organizasyon (v2 — STANDART / PREMIUM) ──────────────────────
//
// Expand-in-place form (the floating modal silently failed in production — an
// ancestor stacking context — so the button and the form must share the same
// DOM subtree). Rebuilt for the two-package structure: pick STANDART or
// PREMIUM, the weekday/weekend base price is chosen automatically from the
// event date, premium add-ons and extra-guest charges are itemised, and the
// final total is always visible before saving.

interface Props { onCreated: () => void }

const EMPTY = {
  childName: "", childAge: "", parentName: "", parentPhone: "",
  packageId: "", eventDate: "", eventTime: "",
  adultCount: "", childCount: "",
  discount: "", deposit: "", depositMethod: "cash" as OrgPaymentMethod,
  notes: "",
}
type Form = typeof EMPTY

function money(n: number): string {
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function NewOrganizationInline({ onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [pkgs, setPkgs] = useState<BirthdayPackage[]>([])
  const [extraKeys, setExtraKeys] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    listActiveBirthdayPackages()
      .then(setPkgs)
      .catch(() => setError("Paketler yüklenemedi"))
  }, [open])

  const selectedPkg = pkgs.find((p) => p.id === form.packageId) ?? null

  // Live price breakdown — recomputed on every relevant change.
  const breakdown = useMemo(() => {
    if (!selectedPkg || !form.eventDate) return null
    return computePrice({
      pkg: selectedPkg,
      isoDate: form.eventDate,
      adultCount: Number(form.adultCount) || 0,
      childCount: Number(form.childCount) || 0,
      selectedExtraKeys: extraKeys,
      discount: Number(form.discount) || 0,
    })
  }, [selectedPkg, form.eventDate, form.adultCount, form.childCount, form.discount, extraKeys])

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((p) => ({ ...p, [key]: value }))
    setError(null)
  }

  function pickPackage(id: string) {
    update("packageId", id)
    setExtraKeys([]) // extras are package-specific
  }

  function toggleExtra(key: string) {
    setExtraKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  async function submit() {
    if (!form.childName.trim())  return setError("Çocuk adı zorunlu")
    if (!form.parentName.trim()) return setError("Veli adı zorunlu")
    if (!form.eventDate)         return setError("Etkinlik tarihi zorunlu")
    if (!selectedPkg)            return setError("Paket seçin")
    if (!breakdown)              return setError("Fiyat hesaplanamadı")

    setBusy(true)
    try {
      const adult = Number(form.adultCount) || 0
      const child = Number(form.childCount) || 0
      const org = await createOrganization({
        child_name:   form.childName.trim(),
        child_age:    form.childAge ? Number(form.childAge) : null,
        parent_name:  form.parentName.trim(),
        parent_phone: form.parentPhone.trim() || null,
        package_id:   selectedPkg.id,
        event_date:   form.eventDate,
        event_time:   form.eventTime || null,
        guest_count:  adult + child,
        total_price:  breakdown.total,
        notes:        form.notes.trim() || null,
        // snapshot / breakdown
        package_name_snapshot: selectedPkg.name,
        package_tier:      selectedPkg.tier,
        is_weekend:        breakdown.isWeekend,
        base_price:        breakdown.basePrice,
        adult_count:       adult,
        child_count:       child,
        extra_guest_count: breakdown.extraGuestCount,
        extra_guest_charge: breakdown.extraGuestCharge,
        extras:            breakdown.extras,
        extras_total:      breakdown.extrasTotal,
        discount:          breakdown.discount,
      })

      // Optional deposit taken at booking → recorded as an org payment so the
      // remaining balance is tracked exactly like any later installment.
      const deposit = Number(form.deposit) || 0
      if (deposit > 0) {
        await addOrgPayment({
          organization_id: org.id,
          amount: deposit,
          method: form.depositMethod,
          kind: "deposit",
          note: "Rezervasyon kaparosu",
        }).catch(() => toast.warning("Rezervasyon oluştu ancak kapora kaydedilemedi"))
      }

      toast.success("Doğum günü rezervasyonu oluşturuldu", {
        description: `${selectedPkg.name} · ${money(breakdown.total)}`,
      })
      setForm(EMPTY); setExtraKeys([]); setOpen(false)
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 200) : "Kaydedilemedi")
    } finally {
      setBusy(false)
    }
  }

  const isWeekend = form.eventDate ? isWeekendDate(form.eventDate) : null

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white">
          <Cake className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {open ? "Yeni Doğum Günü — Form Açık" : "Yeni Doğum Günü Rezervasyonu Oluştur"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Paket seç · tarih gir · fiyat otomatik hesaplansın.
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-5 space-y-5">
          {/* Customer / child / date */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Çocuk Adı *" value={form.childName} onChange={(v) => update("childName", v)} placeholder="Örn. Defne" />
            <Field label="Yaş" type="number" value={form.childAge} onChange={(v) => update("childAge", v)} placeholder="6" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Veli Adı *" value={form.parentName} onChange={(v) => update("parentName", v)} placeholder="Örn. Ayşe Hanım" />
            <Field label="Telefon" type="tel" value={form.parentPhone} onChange={(v) => update("parentPhone", v)} placeholder="0532..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Etkinlik Tarihi *" type="date" value={form.eventDate} onChange={(v) => update("eventDate", v)} />
            <Field label="Saat" type="time" value={form.eventTime} onChange={(v) => update("eventTime", v)} />
          </div>

          {/* Weekday/weekend auto badge */}
          {isWeekend !== null && (
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold",
              isWeekend
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "bg-sky-500/10 text-sky-700 dark:text-sky-300",
            )}>
              <CalendarDays className="w-3.5 h-3.5" />
              {isWeekend ? "Hafta Sonu fiyatı uygulanacak" : "Hafta İçi fiyatı uygulanacak"}
            </div>
          )}

          {/* Package selection */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Paket Seçimi</label>
            {pkgs.length === 0 ? (
              <p className="text-xs text-slate-400">Aktif paket yok.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pkgs.map((p) => (
                  <PackageCard
                    key={p.id}
                    pkg={p}
                    selected={form.packageId === p.id}
                    isWeekend={isWeekend}
                    onSelect={() => pickPackage(p.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {selectedPkg && (
            <>
              {/* Guest counts */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Misafir Sayısı
                  <span className="normal-case tracking-normal font-normal text-slate-400">
                    · dahil kapasite {includedCapacity(selectedPkg)} kişi
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Yetişkin (Anne/Baba)" type="number" value={form.adultCount} onChange={(v) => update("adultCount", v)} placeholder="0" />
                  <Field label="Çocuk" type="number" value={form.childCount} onChange={(v) => update("childCount", v)} placeholder="0" />
                </div>
              </div>

              {/* Premium extras */}
              {selectedPkg.extras.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5" /> Ek Hizmetler <span className="normal-case tracking-normal font-normal text-slate-400">(opsiyonel)</span>
                  </label>
                  <div className="space-y-2">
                    {selectedPkg.extras.map((ex) => (
                      <button
                        key={ex.key}
                        type="button"
                        onClick={() => toggleExtra(ex.key)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all",
                          extraKeys.includes(ex.key)
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                            : "border-slate-200 dark:border-slate-700 hover:border-violet-300",
                        )}
                      >
                        <span className={cn(
                          "w-4 h-4 rounded flex items-center justify-center flex-shrink-0",
                          extraKeys.includes(ex.key) ? "bg-violet-600 text-white" : "border border-slate-300 dark:border-slate-600",
                        )}>
                          {extraKeys.includes(ex.key) && <Check className="w-3 h-3" />}
                        </span>
                        <span className="flex-1 text-xs font-semibold text-slate-800 dark:text-slate-100">{ex.label}</span>
                        <span className="text-xs font-bold text-violet-700 dark:text-violet-300">+{money(ex.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Discount + deposit */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="İndirim (₺)" type="number" value={form.discount} onChange={(v) => update("discount", v)} placeholder="0" />
                <Field label="Kapora (₺)" type="number" value={form.deposit} onChange={(v) => update("deposit", v)} placeholder="0" />
              </div>
              {Number(form.deposit) > 0 && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Kapora Yöntemi</label>
                  <div className="flex gap-2">
                    {(["cash", "card", "transfer"] as OrgPaymentMethod[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => update("depositMethod", m)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border",
                          form.depositMethod === m
                            ? "border-pink-500 bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-300"
                            : "border-slate-200 dark:border-slate-700 text-slate-500",
                        )}
                      >
                        {m === "cash" ? "Nakit" : m === "card" ? "Kart" : "Havale"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live breakdown — always visible before save */}
              {breakdown && <BreakdownCard pkg={selectedPkg} b={breakdown} deposit={Number(form.deposit) || 0} />}
            </>
          )}

          {/* Notes */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Not</label>
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

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => { setOpen(false); setForm(EMPTY); setExtraKeys([]); setError(null) }}
              disabled={busy}
              className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
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
      )}
    </div>
  )
}

// ─── Package card ─────────────────────────────────────────────────────────────

function PackageCard({ pkg, selected, isWeekend, onSelect }: {
  pkg: BirthdayPackage; selected: boolean; isWeekend: boolean | null; onSelect: () => void
}) {
  const isPremium = pkg.tier === "premium"
  const activePrice = isWeekend === null ? null : (isWeekend ? pkg.weekendPrice : pkg.weekdayPrice)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-2xl border-2 p-4 text-left transition-all",
        selected
          ? isPremium
            ? "border-violet-500 bg-violet-50/60 dark:bg-violet-500/10 shadow-sm"
            : "border-pink-500 bg-pink-50/60 dark:bg-pink-500/10 shadow-sm"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-900 dark:text-white">{pkg.name}</span>
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
          isPremium ? "bg-violet-500/15 text-violet-700 dark:text-violet-300" : "bg-pink-500/15 text-pink-700 dark:text-pink-300",
        )}>
          {isPremium ? "Premium" : "Standart"}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        {activePrice != null ? (
          <>
            <span className="text-lg font-bold text-slate-900 dark:text-white">{money(activePrice)}</span>
            <span className="text-[10px] text-slate-400">{isWeekend ? "hafta sonu" : "hafta içi"}</span>
          </>
        ) : (
          <span className="text-[11px] text-slate-500">
            Hafta içi {money(pkg.weekdayPrice ?? pkg.price)} · Hafta sonu {money(pkg.weekendPrice ?? pkg.price)}
          </span>
        )}
      </div>

      <ul className="space-y-0.5 mb-2">
        {pkg.includes.slice(0, 4).map((it, i) => (
          <li key={i} className="text-[10px] text-slate-500 dark:text-slate-400 flex items-start gap-1">
            <Check className="w-2.5 h-2.5 mt-0.5 flex-shrink-0 text-emerald-500" />{it}
          </li>
        ))}
        {pkg.includes.length > 4 && (
          <li className="text-[10px] text-slate-400">+{pkg.includes.length - 4} daha</li>
        )}
      </ul>

      <div className="text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-1.5">
        Kapasite {includedCapacity(pkg)} kişi · ek kişi {money((pkg.extraPersonPrice ?? 0) * (1 + (pkg.extraPersonVatPct ?? 0) / 100))} (KDV dahil)
      </div>
    </button>
  )
}

// ─── Breakdown card ───────────────────────────────────────────────────────────

function BreakdownCard({ pkg, b, deposit }: {
  pkg: BirthdayPackage
  b: ReturnType<typeof computePrice>
  deposit: number
}) {
  const remaining = Math.max(0, b.total - deposit)
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-1.5">
      <Row label={`Paket (${b.isWeekend ? "hafta sonu" : "hafta içi"})`} value={money(b.basePrice)} bold />
      {b.extraGuestCount > 0 && (
        <Row
          label={`Ek misafir · ${b.extraGuestCount} kişi × ${money(b.extraPersonUnit)}`}
          value={`+${money(b.extraGuestCharge)}`}
          hint={`${b.totalGuests} misafir · dahil ${b.includedCapacity}`}
        />
      )}
      {b.extras.map((ex) => (
        <Row key={ex.key} label={ex.label} value={`+${money(ex.price)}`} />
      ))}
      {b.discount > 0 && <Row label="İndirim" value={`−${money(b.discount)}`} tone="discount" />}
      <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
      <Row label="TOPLAM" value={money(b.total)} bold big />
      {deposit > 0 && (
        <>
          <Row label="Kapora" value={`−${money(deposit)}`} tone="discount" />
          <Row label="Kalan Bakiye" value={money(remaining)} bold />
        </>
      )}
      {b.totalGuests > b.includedCapacity && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-1">
          <Info className="w-3 h-3" /> Kapasite aşıldı — ek misafir ücreti otomatik eklendi.
        </p>
      )}
      {pkg.importantNotes && (
        <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 mt-1">{pkg.importantNotes}</p>
      )}
    </div>
  )
}

function Row({ label, value, bold, big, hint, tone }: {
  label: string; value: string; bold?: boolean; big?: boolean; hint?: string
  tone?: "discount"
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn("text-slate-600 dark:text-slate-300", big ? "text-sm font-bold" : "text-xs", bold && !big && "font-semibold")}>
        {label}
        {hint && <span className="block text-[10px] text-slate-400 font-normal">{hint}</span>}
      </span>
      <span className={cn(
        "tabular-nums",
        big ? "text-base font-bold text-slate-900 dark:text-white" : "text-xs",
        bold && !big && "font-bold text-slate-900 dark:text-white",
        tone === "discount" && "text-emerald-600 dark:text-emerald-400",
        !bold && !big && !tone && "text-slate-700 dark:text-slate-200",
      )}>
        {value}
      </span>
    </div>
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
