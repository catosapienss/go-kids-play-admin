"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Plus, Phone, AlertCircle, Wallet, ChevronRight, X, User, StickyNote, Check, Loader2, Crown, Repeat } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  searchParents, getRecentParents, createParent,
  getParentByPhone, getParentQuickStats, normalizePhone,
  type ParentQuickStats,
} from "@/lib/services/pos.service"
import type { ParentWithChildren } from "@/types/operations"
import type { Customer, NewCustomerForm } from "@/types/hizli-kayit"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface CustomerPanelProps {
  selectedCustomer: Customer | null
  onSelect: (customer: Customer) => void
  onClear: () => void
}

const EMPTY_FORM: NewCustomerForm = { name: "", phone: "", notes: "", allergies: "" }

function toCustomer(p: ParentWithChildren): Customer {
  return {
    id: p.id,
    name: p.full_name,
    phone: p.phone,
    notes: p.notes ?? undefined,
    allergies: undefined,
    walletBalance: Number(p.wallet_balance ?? 0),
    children: p.children.map((c) => ({
      id: c.id,
      name: c.full_name,
      age: c.age,
      notes: c.notes ?? null,
    })),
  }
}

export function CustomerPanel({ selectedCustomer, onSelect, onClear }: CustomerPanelProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ParentWithChildren[]>([])
  const [searching, setSearching] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewCustomerForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Returning-customer detection inside the "Yeni Veli" form.
  const [phoneChecking, setPhoneChecking] = useState(false)
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Badge stats for the currently-selected customer.
  const [badge, setBadge] = useState<ParentQuickStats | null>(null)

  // Load recent parents on mount
  useEffect(() => {
    getRecentParents(6).then(setResults).catch(() => setResults([]))
  }, [])

  // ── Returning-customer badge — fetch light stats when a customer is loaded.
  useEffect(() => {
    setBadge(null)
    if (!selectedCustomer) return
    let cancelled = false
    getParentQuickStats(selectedCustomer.id)
      .then((s) => { if (!cancelled) setBadge(s) })
      .catch(() => { /* badge is best-effort */ })
    return () => { cancelled = true }
  }, [selectedCustomer])

  // ── Live phone lookup in the new-customer form. As soon as a full number is
  // typed, if it already belongs to someone we AUTO-LOAD that parent instead of
  // letting staff create a duplicate. Staff only ever types the phone.
  useEffect(() => {
    if (!showForm) return
    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current)
    const norm = normalizePhone(form.phone)
    if (norm.length < 10) { setPhoneChecking(false); return }
    setPhoneChecking(true)
    phoneDebounceRef.current = setTimeout(async () => {
      try {
        const match = await getParentByPhone(form.phone)
        if (match) {
          // Returning customer — load existing record, no duplicate, no error.
          onSelect(toCustomer(match))
          setShowForm(false)
          setForm(EMPTY_FORM)
          const kids = match.children?.length ?? 0
          toast.success(
            `Kayıtlı müşteri yüklendi: ${match.full_name}` + (kids > 0 ? ` · ${kids} çocuk` : ""),
          )
        }
      } catch {
        /* lookup failure must not block manual entry */
      } finally {
        setPhoneChecking(false)
      }
    }, 400)
    return () => { if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.phone, showForm])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      if (query.length === 0) getRecentParents(6).then(setResults).catch(() => {})
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchParents(query)
        setResults(data)
      } catch {
        toast.error("Arama sırasında hata oluştu")
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  async function handleSaveNewCustomer() {
    if (!form.name || !form.phone) return
    setSaving(true)
    try {
      // Reuse an existing parent if the phone is already on file — createParent
      // is now duplicate-safe (checks phone first, recovers from races), so a
      // returning customer is loaded instead of erroring.
      const parent = await createParent({
        full_name: form.name,
        phone: form.phone,
        notes: form.notes || undefined,
      })
      const alreadyExisted = normalizePhone(parent.phone) === normalizePhone(form.phone)
        && parent.full_name !== form.name
      onSelect(toCustomer(parent))
      setSaved(true)
      setTimeout(() => {
        setShowForm(false)
        setForm(EMPTY_FORM)
        setSaved(false)
      }, 800)
      toast.success(alreadyExisted ? "Kayıtlı müşteri yüklendi" : "Veli kaydedildi")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kayıt başarısız"
      toast.error("Veli kaydedilemedi: " + msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Müşteri / Veli</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Telefon veya isimle ara</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); onClear() }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
            showForm
              ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              : "bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-500/25"
          )}
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Vazgeç" : "Yeni Veli"}
        </button>
      </div>

      {/* New customer form */}
      {showForm && (
        <div className="bg-violet-50 dark:bg-violet-500/5 rounded-2xl p-4 border border-violet-100 dark:border-violet-500/20 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide">Yeni Veli Ekle</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Ad Soyad *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  placeholder="Ahmet Yılmaz"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                Telefon * <span className="text-slate-400 font-normal">· kayıtlıysa otomatik yüklenir</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="tel"
                  autoFocus
                  className="w-full pl-8 pr-9 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  placeholder="0532 123 45 67"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                {phoneChecking && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-violet-500 animate-spin" />
                )}
              </div>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                <Search className="w-3 h-3" />
                Telefonu yaz — numara sistemde varsa müşteri kendiliğinden gelir, tekrar kayıt gerekmez.
              </p>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Alerji</label>
              <input
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="Fındık, süt..."
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Not</label>
              <input
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="Ek bilgi..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <button
            onClick={handleSaveNewCustomer}
            disabled={!form.name || !form.phone || saving}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
              saved
                ? "bg-emerald-500 text-white"
                : "bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm"
            )}
          >
            {saved ? (
              <><Check className="w-4 h-4" /> Kaydedildi!</>
            ) : saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
            ) : (
              "Kaydet ve Seç"
            )}
          </button>
        </div>
      )}

      {/* Search */}
      {!showForm && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            placeholder="Telefon veya isim..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {searching ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-violet-500 animate-spin" />
          ) : query ? (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
            </button>
          ) : null}
        </div>
      )}

      {/* Customer list */}
      {!showForm && !selectedCustomer && (
        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
          {query.length > 0 && !searching && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                <Search className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Kayıt bulunamadı</p>
              <p className="text-xs text-slate-400 mt-0.5">Yeni veli ekleyebilirsin</p>
            </div>
          )}
          {query.length === 0 && results.length > 0 && (
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1 pb-1">Son Veliler</p>
          )}
          {results.map((parent) => {
            const kidNames = parent.children.map((c) => c.full_name).filter(Boolean).join(", ")
            return (
              <button
                key={parent.id}
                onClick={() => { onSelect(toCustomer(parent)); setQuery("") }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-500/5 border border-transparent hover:border-violet-100 dark:hover:border-violet-500/20 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-500/20 dark:to-purple-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 text-sm font-bold flex-shrink-0">
                  {(parent.full_name || "?").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  {/* Order: phone → child → parent (per operator request) */}
                  <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums truncate">{parent.phone}</p>
                  <p className="text-[12.5px] text-slate-700 dark:text-slate-300 truncate mt-0.5">
                    {kidNames || <span className="italic text-slate-400">Çocuk kayıtlı değil</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    Veli · {parent.full_name}
                  </p>
                </div>
                {Number(parent.wallet_balance) > 0 && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                    ₺{parent.wallet_balance}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {/* Selected customer detail */}
      {!showForm && selectedCustomer && (
        <div className="flex-1 flex flex-col gap-3 min-h-0 animate-in slide-in-from-top-1 duration-200">
          {/* Customer card */}
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/5 translate-y-6 -translate-x-4" />
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <button
                  onClick={onClear}
                  className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Returning / VIP recognition badge — lets staff spot a familiar
                  customer at a glance. Best-effort; lights up once stats load. */}
              {badge && (badge.isVip || badge.visitCount > 0) && (
                <div className="inline-flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-white/20 backdrop-blur-sm">
                  {badge.isVip ? (
                    <>
                      <Crown className="w-3.5 h-3.5 text-amber-200" />
                      <span className="text-xs font-bold">VIP Müşteri</span>
                    </>
                  ) : (
                    <>
                      <Repeat className="w-3.5 h-3.5 text-violet-100" />
                      <span className="text-xs font-bold">Dönen Müşteri</span>
                    </>
                  )}
                  {badge.visitCount > 0 && (
                    <span className="text-[11px] text-violet-100 font-semibold tabular-nums">
                      · {badge.visitCount} ziyaret
                    </span>
                  )}
                </div>
              )}

              {/* Order: phone → child → parent (per operator request) */}
              <p className="font-bold text-base leading-tight tabular-nums flex items-center gap-1.5">
                <Phone className="w-3 h-3" />
                {selectedCustomer.phone}
              </p>
              <p className="text-white text-[13px] leading-snug mt-1">
                {selectedCustomer.children.length > 0
                  ? selectedCustomer.children.map((c) => c.name).join(", ")
                  : <span className="italic text-violet-200">Çocuk kayıtlı değil</span>}
              </p>
              <p className="text-violet-200 text-xs mt-0.5">
                Veli · {selectedCustomer.name}
              </p>
              {selectedCustomer.walletBalance > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Wallet className="w-3.5 h-3.5 text-violet-200" />
                  <span className="text-sm font-semibold">₺{selectedCustomer.walletBalance} bakiye</span>
                </div>
              )}
            </div>
          </div>

          {/* Info chips */}
          <div className="flex flex-wrap gap-2">
            {selectedCustomer.allergies && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-100 dark:border-red-500/20">
                <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-700 dark:text-red-400 font-medium">{selectedCustomer.allergies}</span>
              </div>
            )}
            {selectedCustomer.notes && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-100 dark:border-amber-500/20">
                <StickyNote className="w-3 h-3 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium truncate max-w-[140px]">{selectedCustomer.notes}</span>
              </div>
            )}
          </div>

          {/* Registered children */}
          {selectedCustomer.children.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Kayıtlı Çocuklar</p>
              <div className="space-y-1.5">
                {selectedCustomer.children.map((child) => (
                  <div key={child.id} className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-100 to-violet-100 dark:from-pink-500/20 dark:to-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400 flex-shrink-0">
                      {child.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{child.name}</p>
                    </div>
                    <Badge className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-0 text-[10px] font-medium">
                      {child.age} yaş
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
