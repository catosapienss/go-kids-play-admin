"use client"

import { useEffect, useState } from "react"
import { Ticket, Plus, X, Loader2, Check, Calendar, Wallet } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/utils"
import {
  listAllPersonalEntitlements, createPersonalEntitlement,
  type PersonalEntitlementRow,
} from "@/lib/services/membership.service"
import { getChildrenByParent, type ChildRow } from "@/lib/services/pos.service"
import { CustomerSearchPalette } from "@/components/crm/customer-search-palette"
import type { CustomerSummary } from "@/types/customer"

// ─── Personal Access Entitlements — admin panel (Üyelikler) ──────────────────
//
// Owner/admin creates and reviews customer-specific access entitlements (e.g.
// "Elis — 20 Günlük Erişim, ₺5.000"). These are NOT catalog packages: each is
// bound to one parent+child and only appears here and in that child's Quick
// Registration picker.

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }) }
  catch { return "—" }
}

export function PersonalEntitlementPanel() {
  const [rows, setRows] = useState<PersonalEntitlementRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setRows(null); setError(null)
    void listAllPersonalEntitlements()
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [reloadKey])

  return (
    <div className="rounded-2xl border border-teal-200/70 dark:border-teal-900/40 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3.5 bg-teal-50/70 dark:bg-teal-500/[0.06] border-b border-teal-200/60 dark:border-teal-900/40 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center flex-shrink-0">
          <Ticket className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-teal-900 dark:text-teal-100 leading-tight">Kişisel Erişim Hakları</h3>
          <p className="text-[11px] text-teal-700/80 dark:text-teal-300/80">Müşteriye özel giriş hakları · katalog dışı</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white"
        >
          <Plus className="w-3.5 h-3.5" /> Yeni Kişisel Hak
        </button>
      </div>

      {rows === null && !error ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-teal-500" /></div>
      ) : error ? (
        <div className="p-6 text-sm text-rose-600 dark:text-rose-400">{error}</div>
      ) : rows && rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">Henüz kişisel erişim hakkı yok.</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {(rows ?? []).map((r) => {
            const used = (r.totalUses ?? 0) - (r.remainingUses ?? 0)
            const exhausted = (r.remainingUses ?? 0) <= 0
            return (
              <div key={r.id} className="px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{r.label || "Kişisel Erişim"}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{r.parentName} · {r.childName}</p>
                </div>
                <Metric label="Toplam" value={String(r.totalUses ?? 0)} />
                <Metric label="Kullanılan" value={String(used)} />
                <Metric label="Kalan" value={String(r.remainingUses ?? 0)} tone={exhausted ? "danger" : "ok"} />
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1 justify-end"><Calendar className="w-3 h-3" />Aktivasyon</p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{fmtDate(r.startedAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1 justify-end"><Wallet className="w-3 h-3" />Ödeme</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{formatTRY(r.price)}</p>
                  <p className={cn("text-[10px] font-semibold", r.paymentStatus === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                    {r.paymentStatus === "paid" ? "Ödendi" : r.paymentStatus === "partial" ? "Kısmi" : r.paymentStatus === "unpaid" ? "Ödenmedi" : "—"}
                  </p>
                </div>
                <StatusChip status={r.status} exhausted={exhausted} />
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreatePersonalEntitlementDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setReloadKey((k) => k + 1) }}
        />
      )}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</p>
      <p className={cn("text-lg font-black tabular-nums",
        tone === "danger" ? "text-rose-600 dark:text-rose-400"
        : tone === "ok" ? "text-teal-600 dark:text-teal-300"
        : "text-slate-900 dark:text-white")}>{value}</p>
    </div>
  )
}

function StatusChip({ status, exhausted }: { status: string; exhausted: boolean }) {
  const cfg = status === "active" && !exhausted
    ? { cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Aktif" }
    : status === "expired" || exhausted
      ? { cls: "bg-slate-500/10 text-slate-500 dark:text-slate-400", label: "Tükendi" }
      : status === "cancelled"
        ? { cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400", label: "İptal" }
        : { cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400", label: status }
  return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", cfg.cls)}>{cfg.label}</span>
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreatePersonalEntitlementDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customer, setCustomer] = useState<CustomerSummary | null>(null)
  const [kids, setKids] = useState<ChildRow[]>([])
  const [childId, setChildId] = useState("")
  const [label, setLabel] = useState("")
  const [price, setPrice] = useState("")
  const [uses, setUses] = useState("")
  const [method, setMethod] = useState<"cash" | "card" | "transfer">("cash")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!customer) { setKids([]); setChildId(""); return }
    void getChildrenByParent(customer.id).then((cs) => {
      setKids(cs)
      if (cs.length === 1) setChildId(cs[0].id)
    })
  }, [customer])

  async function submit() {
    if (!customer || !childId) { toast.warning("Müşteri ve çocuk seçin"); return }
    const p = parseFloat(price.replace(",", ".")) || 0
    const u = parseInt(uses) || 0
    if (u <= 0) { toast.warning("Kullanım gün sayısını girin"); return }
    if (!label.trim()) { toast.warning("Hak adını girin (ör. 20 Günlük Erişim)"); return }
    setBusy(true)
    try {
      await createPersonalEntitlement({
        parentId: customer.id, childId, label: label.trim(),
        price: p, uses: u, paymentMethod: method, paymentStatus: "paid",
      })
      toast.success("Kişisel erişim hakkı oluşturuldu")
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Oluşturulamadı")
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Ticket className="w-4 h-4 text-teal-600" />
          <p className="text-sm font-bold text-slate-900 dark:text-white flex-1">Yeni Kişisel Erişim Hakkı</p>
          <button type="button" onClick={onClose} aria-label="Kapat" className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!customer ? (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Müşteri (Veli)</label>
              <CustomerSearchPalette onSelect={setCustomer} autoFocus />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{customer.fullName}</p>
                  <p className="text-[11px] text-slate-500">{customer.phone}</p>
                </div>
                <button type="button" onClick={() => setCustomer(null)} className="text-[11px] font-semibold text-teal-600 hover:underline">Değiştir</button>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Çocuk</label>
                {kids.length === 0 ? (
                  <p className="text-xs text-slate-400">Bu velinin kayıtlı çocuğu yok.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {kids.map((k) => (
                      <button key={k.id} type="button" onClick={() => setChildId(k.id)}
                        className={cn("px-3 py-2 rounded-xl border-2 text-left text-sm font-semibold transition-colors",
                          childId === k.id ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-200" : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-300")}>
                        {k.fullName}{k.age != null ? ` · ${k.age}` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Hak Adı" value={label} onChange={setLabel} placeholder="20 Günlük Erişim" />
                <Field label="Kullanım (gün)" type="number" value={uses} onChange={setUses} placeholder="20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fiyat (₺)" type="number" value={price} onChange={setPrice} placeholder="5000" />
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Ödeme</label>
                  <div className="flex gap-1.5">
                    {(["cash", "card", "transfer"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setMethod(m)}
                        className={cn("flex-1 px-2 py-2 rounded-lg text-xs font-semibold border",
                          method === m ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300" : "border-slate-200 dark:border-slate-700 text-slate-500")}>
                        {m === "cash" ? "Nakit" : m === "card" ? "Kart" : "Havale"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white">Vazgeç</button>
          <button type="button" onClick={submit} disabled={busy || !customer || !childId}
            className={cn("text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5",
              busy || !customer || !childId ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-500 text-white")}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {busy ? "Oluşturuluyor…" : "Hakkı Oluştur"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-teal-500" />
    </div>
  )
}
