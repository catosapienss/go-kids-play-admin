"use client"

import { useEffect, useRef, useState } from "react"
import { X, Check, Loader2, Coffee, CalendarClock, Users, Banknote, CreditCard, UserPlus, Trash2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { cn, formatTRY } from "@/lib/utils"
import { listPackages, sellMembership } from "@/lib/services/membership.service"
import {
  getChildrenByParent, createParent, createChild, getParentByPhone, normalizePhone,
  type ChildRow,
} from "@/lib/services/pos.service"
import type { MembershipPackage } from "@/types/membership"
import { CustomerSearchPalette } from "@/components/crm/customer-search-palette"
import type { CustomerSummary } from "@/types/customer"

// ─── Monthly membership sale (single + sibling) ──────────────────────────────
//
// Sells the configurable monthly packages (Aylık Üyelik / 2 Kardeş Aylık Üyelik).
// Enforces the package's included-children count (single=1, sibling=exactly 2),
// shows the Brewmood benefit + weekend rule, and takes payment. All rules come
// from the DB package config (migration 035) — never hardcoded here.
//
// A walk-in parent with no record can be registered inline ("new" step) — the
// campaign is advertised publicly, so the first contact is often an unregistered
// customer. Phone is the customer key: it's checked live against the existing
// duplicate-safe lookup, so a returning parent is reused, never re-created.

type Step = "customer" | "new" | "package" | "children" | "pay"

interface NewChildDraft { key: number; name: string; age: string }

// A freshly-registered parent has no visit/wallet history yet. The sale flow
// only ever reads id/fullName/phone, so the rest are neutral placeholders.
const EMPTY_SUMMARY: CustomerSummary = {
  id: "", fullName: "", phone: "", walletBalance: 0, tags: [], isVip: false,
  notes: null, registeredAt: "", lastVisitAt: null, branchId: null,
  visitCount: 0, completedCount: 0, lastSessionAt: null,
  totalSpent: 0, paymentCount: 0, walletLoaded: 0,
  refundTotal: 0, refundCount: 0, childCount: 0,
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function MembershipPackageSaleDialog({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>("customer")
  const [customer, setCustomer] = useState<CustomerSummary | null>(null)
  const [packages, setPackages] = useState<MembershipPackage[]>([])
  const [pkg, setPkg] = useState<MembershipPackage | null>(null)
  const [children, setChildren] = useState<ChildRow[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [cash, setCash] = useState(0)
  const [card, setCard] = useState(0)
  const [busy, setBusy] = useState(false)

  // ── Inline new-customer registration ──────────────────────────────────────
  const [nName, setNName] = useState("")
  const [nPhone, setNPhone] = useState("")
  const [nKids, setNKids] = useState<NewChildDraft[]>([{ key: 1, name: "", age: "" }])
  const [phoneMatch, setPhoneMatch] = useState<CustomerSummary | null>(null)
  const [phoneChecking, setPhoneChecking] = useState(false)
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setStep("customer"); setCustomer(null); setPkg(null); setChildren(null)
    setPicked([]); setCash(0); setCard(0)
    setNName(""); setNPhone(""); setNKids([{ key: 1, name: "", age: "" }])
    setPhoneMatch(null); setPhoneChecking(false)
    void listPackages({ onlyActive: true }).then(setPackages)
  }, [open])

  // Live phone lookup — mirrors the Hızlı Kayıt behaviour: as soon as a full
  // number is typed, surface an existing parent instead of letting staff create
  // a duplicate. Phone is the unique customer key.
  useEffect(() => {
    if (step !== "new") return
    if (phoneDebounce.current) clearTimeout(phoneDebounce.current)
    if (normalizePhone(nPhone).length < 10) { setPhoneMatch(null); setPhoneChecking(false); return }
    setPhoneChecking(true)
    phoneDebounce.current = setTimeout(async () => {
      try {
        const match = await getParentByPhone(nPhone)
        setPhoneMatch(match ? { ...EMPTY_SUMMARY, id: match.id, fullName: match.full_name, phone: match.phone } : null)
      } catch {
        setPhoneMatch(null)
      } finally { setPhoneChecking(false) }
    }, 400)
    return () => { if (phoneDebounce.current) clearTimeout(phoneDebounce.current) }
  }, [nPhone, step])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  async function pickCustomer(c: CustomerSummary) {
    setCustomer(c)
    setChildren(await getChildrenByParent(c.id))
    setStep("package")
  }

  const nKidsFilled = nKids.filter((k) => k.name.trim().length > 0)
  const kidAgesOk = nKidsFilled.every((k) => {
    const a = Number.parseInt(k.age, 10)
    return Number.isFinite(a) && a >= 0 && a <= 18
  })
  const newCustomerOk =
    nName.trim().length > 1 && normalizePhone(nPhone).length >= 10 &&
    nKidsFilled.length > 0 && kidAgesOk

  async function saveNewCustomer() {
    if (!newCustomerOk || busy) return
    setBusy(true)
    try {
      // createParent is duplicate-safe: an existing phone returns that parent
      // rather than erroring, so a returning customer is reused.
      const parent = await createParent({ full_name: nName.trim(), phone: nPhone.trim() })

      // The parent may have pre-existed (phone match / race). Only add children
      // whose names aren't already on file, so re-entering a known family can
      // never fan out duplicate child rows.
      const existing = await getChildrenByParent(parent.id)
      const known = new Set(existing.map((c) => c.fullName.trim().toLocaleLowerCase("tr")))
      for (const k of nKidsFilled) {
        if (known.has(k.name.trim().toLocaleLowerCase("tr"))) continue
        await createChild({
          parent_id: parent.id,
          full_name: k.name.trim(),
          age: Number.parseInt(k.age, 10),
        })
      }

      const kids = await getChildrenByParent(parent.id)
      setCustomer({ ...EMPTY_SUMMARY, id: parent.id, fullName: parent.full_name, phone: parent.phone })
      setChildren(kids)
      toast.success(existing.length > 0 ? "Mevcut müşteri kullanıldı" : "Müşteri kaydedildi", {
        description: `${parent.full_name} · ${kids.length} çocuk`,
      })
      setStep("package")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Müşteri kaydedilemedi")
    } finally { setBusy(false) }
  }

  function pickPackage(p: MembershipPackage) {
    setPkg(p); setPicked([]); setCash(p.price); setCard(0); setStep("children")
  }

  function toggleChild(id: string) {
    if (!pkg) return
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= pkg.includedChildren) {
        // single: replace; sibling: cap at 2
        return pkg.includedChildren === 1 ? [id] : [...prev, id].slice(-pkg.includedChildren)
      }
      return [...prev, id]
    })
  }

  const total = cash + card
  const childOk = !!pkg && picked.length === pkg.includedChildren

  async function submit() {
    if (!customer || !pkg || busy || !childOk) return
    setBusy(true)
    try {
      await sellMembership({
        packageId: pkg.id, parentId: customer.id, childIds: picked,
        cash, card, wallet: 0,
      })
      toast.success("Üyelik satıldı", { description: `${pkg.name} · ${formatTRY(total)}` })
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Üyelik satılamadı")
    } finally { setBusy(false) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white flex-1">
            {step === "customer" ? "Müşteri seç" : step === "new" ? "Yeni müşteri kaydı"
             : step === "package" ? "Üyelik paketi"
             : step === "children" ? "Çocuk seçimi" : "Ödeme"}
          </p>
          <button type="button" onClick={onClose} aria-label="Kapat" className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "customer" && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setStep("new")}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 text-sm font-bold transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Kaydı yok · Yeni müşteri oluştur
              </button>
              <CustomerSearchPalette autoFocus onSelect={pickCustomer} className="h-[52vh]" />
            </div>
          )}

          {step === "new" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <TextField label="Veli adı soyadı" value={nName} onChange={setNName} placeholder="Ayşe Yılmaz" autoFocus />
                <div>
                  <TextField label="Telefon" value={nPhone} onChange={setNPhone} placeholder="0532 000 00 00" inputMode="tel" />
                  {phoneChecking && (
                    <p className="text-[11px] text-slate-400 mt-1 inline-flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Numara kontrol ediliyor…
                    </p>
                  )}
                  {phoneMatch && (
                    <button
                      type="button"
                      onClick={() => void pickCustomer(phoneMatch)}
                      className="mt-2 w-full text-left rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-3 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                    >
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Bu numara zaten kayıtlı</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{phoneMatch.fullName}</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-semibold">Mevcut müşteriyle devam et →</p>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Çocuklar</p>
                {nKids.map((k, i) => (
                  <div key={k.key} className="flex items-end gap-2">
                    <div className="flex-1">
                      <TextField
                        label={i === 0 ? "Çocuk adı" : undefined}
                        value={k.name}
                        onChange={(v) => setNKids((prev) => prev.map((x) => x.key === k.key ? { ...x, name: v } : x))}
                        placeholder="Çocuk adı"
                      />
                    </div>
                    <div className="w-20">
                      <TextField
                        label={i === 0 ? "Yaş" : undefined}
                        value={k.age}
                        onChange={(v) => setNKids((prev) => prev.map((x) => x.key === k.key ? { ...x, age: v.replace(/\D/g, "").slice(0, 2) } : x))}
                        placeholder="5"
                        inputMode="numeric"
                      />
                    </div>
                    {nKids.length > 1 && (
                      <button type="button" onClick={() => setNKids((prev) => prev.filter((x) => x.key !== k.key))}
                        aria-label="Çocuğu kaldır"
                        className="h-[38px] w-9 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {nKids.length < 4 && (
                  <button type="button"
                    onClick={() => setNKids((prev) => [...prev, { key: Date.now(), name: "", age: "" }])}
                    className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline">
                    + Çocuk ekle
                  </button>
                )}
                <p className="text-[11px] text-slate-400">
                  2 Kardeş paketi için en az iki çocuk ekleyin.
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button type="button" onClick={() => setStep("customer")}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  <ArrowLeft className="w-3.5 h-3.5" /> Geri
                </button>
                <button type="button" disabled={!newCustomerOk || busy} onClick={() => void saveNewCustomer()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Kaydet ve devam et
                </button>
              </div>
            </div>
          )}

          {step === "package" && customer && (
            <div className="space-y-3">
              <CustomerChip customer={customer} />
              {packages.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Aktif üyelik paketi yok</p>}
              {packages.map((p) => (
                <button key={p.id} type="button" onClick={() => pickPackage(p)}
                  className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-violet-400 bg-white dark:bg-slate-900 p-4 text-left transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-bold text-slate-900 dark:text-white">{p.name}</p>
                    <p className="text-base font-black text-violet-600 dark:text-violet-400 tabular-nums">{formatTRY(p.price)}<span className="text-[10px] text-slate-400 font-normal"> /ay</span></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{p.includedChildren} çocuk</span>
                    <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />{p.weekdayUnlimited ? "Hafta içi sınırsız" : "—"} · hafta sonu {p.weekendDailyMinutes} dk/gün</span>
                    {p.brewmoodDiscountPct > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold"><Coffee className="w-3 h-3" />%{p.brewmoodDiscountPct} Brewmood</span>
                    )}
                  </div>
                </button>
              ))}
              <div className="flex justify-end"><button onClick={() => setStep("customer")} className="px-3 py-2 text-xs font-bold text-slate-500">Geri</button></div>
            </div>
          )}

          {step === "children" && pkg && (
            <div className="space-y-3">
              <CustomerChip customer={customer!} />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-200">{pkg.name}</span> için <span className="font-bold">{pkg.includedChildren === 2 ? "tam 2 kardeş" : "1 çocuk"}</span> seç
                <span className="ml-1 text-violet-600 dark:text-violet-400 font-bold">({picked.length}/{pkg.includedChildren})</span>
              </p>
              {children === null ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              : children.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Bu velinin kayıtlı çocuğu yok — önce çocuk ekleyin.</p>
              : (
                <div className="space-y-1.5">
                  {children.map((ch) => {
                    const sel = picked.includes(ch.id)
                    return (
                      <button key={ch.id} type="button" onClick={() => toggleChild(ch.id)}
                        className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-colors",
                          sel ? "border-violet-500 bg-violet-50/60 dark:bg-violet-500/[0.08]" : "border-slate-200 dark:border-slate-700")}>
                        <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0",
                          sel ? "bg-violet-600 border-violet-600 text-white" : "border-slate-300 dark:border-slate-600")}>
                          {sel && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ch.fullName}</span>
                        {ch.age != null && <span className="text-[11px] text-slate-400">{ch.age} yaş</span>}
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="flex justify-between pt-1">
                <button onClick={() => setStep("package")} className="px-3 py-2 text-xs font-bold text-slate-500">Geri</button>
                <button onClick={() => setStep("pay")} disabled={!childOk}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">Devam</button>
              </div>
            </div>
          )}

          {step === "pay" && pkg && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{pkg.name}</p>
                  <p className="text-lg font-black text-violet-600 dark:text-violet-400 tabular-nums">{formatTRY(pkg.price)}</p>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{picked.length} çocuk · 30 gün · %{pkg.brewmoodDiscountPct} Brewmood</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MoneyInput label="Nakit" icon={<Banknote className="w-3.5 h-3.5" />} value={cash} onChange={setCash} />
                <MoneyInput label="Kart"  icon={<CreditCard className="w-3.5 h-3.5" />} value={card} onChange={setCard} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Tahsil edilen</span>
                <span className={cn("font-bold tabular-nums", Math.abs(total - pkg.price) < 0.01 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>{formatTRY(total)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <button onClick={() => setStep("children")} className="px-3 py-2 text-xs font-bold text-slate-500">Geri</button>
                <button onClick={submit} disabled={busy}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5">
                  {busy && <Loader2 className="w-3 h-3 animate-spin" />} Üyeliği Sat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder, autoFocus, inputMode }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string
  autoFocus?: boolean; inputMode?: "tel" | "numeric"
}) {
  return (
    <label className="block">
      {label && <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">{label}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        inputMode={inputMode}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
    </label>
  )
}

function CustomerChip({ customer }: { customer: CustomerSummary }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-3">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Müşteri</p>
      <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{customer.fullName}</p>
      <p className="text-[11px] text-slate-500">{customer.phone}</p>
    </div>
  )
}

function MoneyInput({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">{icon}{label}</label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₺</span>
        <input type="number" min={0} value={value || ""} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full pl-6 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold tabular-nums text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30" />
      </div>
    </div>
  )
}
