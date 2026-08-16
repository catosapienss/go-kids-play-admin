"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Cake, Phone, Calendar, Clock, Users, Package,
  CreditCard, Banknote, ArrowDownLeft, Plus, Loader2, Check, X,
  CheckCircle2, XCircle, AlertCircle, Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { MainLayout } from "@/components/layout/main-layout"
import { cn } from "@/lib/utils"
import {
  getOrganization, listOrgPayments, addOrgPayment,
  updateOrganizationStatus, deleteOrganization,
  type OrganizationRow, type OrgPaymentRow, type OrgPaymentMethod, type OrgPaymentKind,
} from "@/lib/services/organizations.service"
import { createClient } from "@/lib/supabase/client"

interface PackageInfo { id: string; name: string; price: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return "₺" + Math.round(n).toLocaleString("tr-TR")
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
}

function daysFromNow(iso: string): number {
  const today = new Date(); today.setHours(0,0,0,0)
  const t = new Date(iso); t.setHours(0,0,0,0)
  return Math.round((t.getTime() - today.getTime()) / 86400000)
}

const STATUS_META: Record<OrganizationRow["status"], { label: string; cls: string }> = {
  pending:   { label: "Bekliyor",   cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  confirmed: { label: "Onaylandı",  cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  completed: { label: "Tamamlandı", cls: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" },
  cancelled: { label: "İptal",      cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" },
}

const METHOD_LABEL: Record<OrgPaymentMethod, string> = {
  cash: "Nakit", card: "Kart", transfer: "Havale", wallet: "Cüzdan",
}
const KIND_LABEL: Record<OrgPaymentKind, string> = {
  deposit: "Kapora", installment: "Taksit", full: "Tam ödeme", refund: "İade",
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OrgDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [org, setOrg]           = useState<OrganizationRow | null>(null)
  const [pkg, setPkg]           = useState<PackageInfo | null>(null)
  const [payments, setPayments] = useState<OrgPaymentRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showPay, setShowPay]   = useState(false)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const o = await getOrganization(id)
      if (!o) { setNotFound(true); return }
      setOrg(o)
      const [pays, pkgRow] = await Promise.all([
        listOrgPayments(id),
        o.package_id
          ? createClient().from("birthday_packages").select("id,name,price").eq("id", o.package_id).maybeSingle()
              .then(({ data }) => data as PackageInfo | null)
          : Promise.resolve(null),
      ])
      setPayments(pays)
      setPkg(pkgRow)
    } catch (e) {
      toast.error("Yüklenemedi: " + (e instanceof Error ? e.message.slice(0, 120) : "hata"))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void reload() }, [reload])

  async function setStatus(s: OrganizationRow["status"]) {
    if (!org) return
    try {
      await updateOrganizationStatus(org.id, s)
      toast.success("Durum güncellendi")
      void reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata")
    }
  }

  async function remove() {
    if (!org) return
    if (!confirm(`"${org.child_name}" rezervasyonu silinsin mi?`)) return
    try {
      await deleteOrganization(org.id)
      toast.success("Silindi")
      router.push("/dogum-gunleri")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata")
    }
  }

  // ── render ──
  if (loading) {
    return (
      <MainLayout title="Doğum Günü">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </MainLayout>
    )
  }

  if (notFound || !org) {
    return (
      <MainLayout title="Doğum Günü">
        <div className="max-w-md mx-auto text-center py-16">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Rezervasyon bulunamadı</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Bu organizasyon silinmiş olabilir.</p>
          <button onClick={() => router.push("/dogum-gunleri")}
                  className="text-xs font-semibold px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white">
            Doğum Günleri'ne dön
          </button>
        </div>
      </MainLayout>
    )
  }

  const total      = Number(org.total_price) || pkg?.price || 0
  const paid       = payments.reduce((acc, p) => acc + (p.kind === "refund" ? -Number(p.amount) : Number(p.amount)), 0)
  const balance    = Math.max(0, total - paid)
  const paidPct    = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  const days       = daysFromNow(org.event_date)
  const meta       = STATUS_META[org.status]

  return (
    <MainLayout title={`${org.child_name}`} subtitle="Doğum Günü Rezervasyonu">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Back */}
        <button onClick={() => router.back()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" /> Geri
        </button>

        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-violet-600 p-5 text-white shadow-lg shadow-pink-500/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-xl flex-shrink-0">
              <Cake className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-black truncate">{org.child_name}</h1>
                {org.child_age != null && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">
                    {org.child_age} yaş
                  </span>
                )}
              </div>
              <p className="text-xs text-white/85 truncate">{org.parent_name}{org.parent_phone ? ` · ${org.parent_phone}`:""}</p>
              <div className="mt-3 flex items-center gap-3 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3"/>{fmtDate(org.event_date)}</span>
                {org.event_time && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3"/>{org.event_time.slice(0,5)}</span>}
                <span className="inline-flex items-center gap-1"><Users className="w-3 h-3"/>{org.guest_count}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={cn("inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md", meta.cls)}>
                {meta.label}
              </span>
              {days > 0 && org.status !== "cancelled" && org.status !== "completed" && (
                <p className="text-[10px] text-white/80 mt-1">{days} gün kaldı</p>
              )}
              {days === 0 && <p className="text-[10px] text-white/80 mt-1 font-bold">BUGÜN</p>}
            </div>
          </div>
        </div>

        {/* Payment summary card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-0.5">Ödeme</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{fmt(paid)} <span className="text-sm text-slate-400 font-medium">/ {fmt(total)}</span></p>
            </div>
            <button onClick={() => setShowPay(true)}
                    className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 shadow-sm">
              <Plus className="w-3.5 h-3.5"/> Ödeme Ekle
            </button>
          </div>

          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                 style={{ width: `${paidPct}%` }} />
          </div>
          <div className="flex items-center justify-between text-[11px] mt-1.5 text-slate-500 dark:text-slate-400 tabular-nums">
            <span>Ödenen: <strong className="text-emerald-600 dark:text-emerald-400">{fmt(paid)}</strong></span>
            <span>Kalan: <strong className={cn(balance > 0 ? "text-rose-600 dark:text-rose-400":"text-slate-400")}>{fmt(balance)}</strong></span>
          </div>

          {/* Payment list */}
          {payments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 py-1.5">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                    p.kind === "refund"
                      ? "bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300"
                      : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
                  )}>
                    {p.kind === "refund" ? <ArrowDownLeft className="w-3.5 h-3.5"/> : (p.method === "cash" ? <Banknote className="w-3.5 h-3.5"/> : <CreditCard className="w-3.5 h-3.5"/>)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{KIND_LABEL[p.kind]} · {METHOD_LABEL[p.method]}</p>
                    <p className="text-[10px] text-slate-500">{new Date(p.created_at).toLocaleString("tr-TR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}{p.note ? ` · ${p.note}`:""}</p>
                  </div>
                  <p className={cn(
                    "text-sm font-black tabular-nums",
                    p.kind === "refund" ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white",
                  )}>
                    {p.kind === "refund" ? "−" : "+"}{fmt(Number(p.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Price breakdown — shows exactly why the total differs from the base.
            Only for v2 reservations that carry a snapshot; historical rows have
            no base_price and simply keep their original total above. */}
        {org.base_price != null && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-3">Fiyat Dökümü</p>
            <div className="space-y-1.5 text-xs">
              <BreakdownLine label={`Paket (${org.is_weekend ? "hafta sonu" : "hafta içi"})`} value={fmt(Number(org.base_price))} bold />
              {Number(org.extra_guest_charge ?? 0) > 0 && (
                <BreakdownLine label={`Ek misafir · ${org.extra_guest_count} kişi`} value={`+${fmt(Number(org.extra_guest_charge))}`} />
              )}
              {(org.extras ?? []).map((ex) => (
                <BreakdownLine key={ex.key} label={ex.label} value={`+${fmt(Number(ex.price))}`} />
              ))}
              {Number(org.discount ?? 0) > 0 && (
                <BreakdownLine label="İndirim" value={`−${fmt(Number(org.discount))}`} discount />
              )}
              <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
              <BreakdownLine label="TOPLAM" value={fmt(total)} bold big />
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <InfoRow icon={Package} label="Paket" value={org.package_name_snapshot ?? pkg?.name ?? "—"} />
          {org.package_tier && (
            <InfoRow icon={Package} label="Paket Tipi" value={org.package_tier === "premium" ? "Premium" : "Standart"} />
          )}
          {org.is_weekend != null && (
            <InfoRow icon={Calendar} label="Gün Tipi" value={org.is_weekend ? "Hafta Sonu" : "Hafta İçi"} />
          )}
          <InfoRow icon={Calendar} label="Tarih" value={fmtDate(org.event_date)} />
          <InfoRow icon={Clock} label="Saat" value={org.event_time?.slice(0,5) || "—"} />
          <InfoRow
            icon={Users}
            label="Misafir"
            value={org.adult_count != null || org.child_count != null
              ? `${org.adult_count ?? 0} yetişkin · ${org.child_count ?? 0} çocuk (${org.guest_count} toplam)`
              : `${org.guest_count} misafir`}
          />
          <InfoRow icon={Phone} label="Veli" value={`${org.parent_name}${org.parent_phone ? ` · ${org.parent_phone}` : ""}`} />
          {org.notes && (
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-500/5 border-t border-amber-100 dark:border-amber-500/20">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">Not</p>
              <p className="text-xs text-amber-800 dark:text-amber-200 whitespace-pre-wrap">{org.notes}</p>
            </div>
          )}
        </div>

        {/* Status actions */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center gap-2 flex-wrap shadow-sm">
          {org.status !== "confirmed" && org.status !== "completed" && org.status !== "cancelled" && (
            <ActionBtn onClick={() => setStatus("confirmed")} icon={CheckCircle2} color="emerald">Onayla</ActionBtn>
          )}
          {org.status !== "completed" && org.status !== "cancelled" && (
            <ActionBtn onClick={() => setStatus("completed")} icon={Check} color="slate">Tamamlandı</ActionBtn>
          )}
          {org.status !== "cancelled" && (
            <ActionBtn onClick={() => setStatus("cancelled")} icon={XCircle} color="rose">İptal Et</ActionBtn>
          )}
          <div className="flex-1" />
          <button onClick={remove}
                  className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-3 py-2 rounded-lg inline-flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5"/> Sil
          </button>
        </div>
      </div>

      {showPay && (
        <PaymentModal
          orgId={org.id}
          remaining={balance}
          onClose={() => setShowPay(false)}
          onSaved={() => { setShowPay(false); void reload() }}
        />
      )}
    </MainLayout>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: typeof Cake; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 flex-shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 w-20 flex-shrink-0">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white text-right flex-1 truncate">{value}</p>
    </div>
  )
}

function BreakdownLine({ label, value, bold, big, discount }: {
  label: string; value: string; bold?: boolean; big?: boolean; discount?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn("text-slate-600 dark:text-slate-300", big ? "text-sm font-bold" : bold ? "font-semibold" : "")}>{label}</span>
      <span className={cn(
        "tabular-nums",
        big ? "text-base font-black text-slate-900 dark:text-white"
          : bold ? "font-bold text-slate-900 dark:text-white"
          : discount ? "text-emerald-600 dark:text-emerald-400"
          : "text-slate-700 dark:text-slate-200",
      )}>{value}</span>
    </div>
  )
}

function ActionBtn({ onClick, icon: Icon, color, children }: {
  onClick: () => void; icon: typeof Check; color: "emerald" | "slate" | "rose"; children: React.ReactNode
}) {
  const palette = {
    emerald: "bg-emerald-600 hover:bg-emerald-500 text-white",
    slate:   "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white",
    rose:    "bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-300",
  }[color]
  return (
    <button onClick={onClick}
            className={cn("text-[11px] font-bold px-3 py-2 rounded-lg inline-flex items-center gap-1.5", palette)}>
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  )
}

function PaymentModal({ orgId, remaining, onClose, onSaved }: {
  orgId: string; remaining: number; onClose: () => void; onSaved: () => void
}) {
  const [amount, setAmount] = useState(remaining > 0 ? String(Math.min(remaining, Math.round(remaining/2))) : "")
  const [method, setMethod] = useState<OrgPaymentMethod>("cash")
  const [kind, setKind]     = useState<OrgPaymentKind>("deposit")
  const [note, setNote]     = useState("")
  const [busy, setBusy]     = useState(false)

  async function submit() {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return toast.error("Tutar geçersiz")
    setBusy(true)
    try {
      await addOrgPayment({ organization_id: orgId, amount: n, method, kind, note: note.trim() || null })
      toast.success(`${KIND_LABEL[kind]} kaydedildi`)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Ödeme Ekle</h3>
          <button onClick={onClose} className="p-1 -m-1 rounded text-slate-400 hover:text-slate-900"><X className="w-4 h-4"/></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Tip</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["deposit","installment","full","refund"] as OrgPaymentKind[]).map((k) => (
                <button key={k} onClick={() => setKind(k)}
                        className={cn(
                          "text-[11px] font-bold py-2 rounded-lg border-2 transition-all",
                          kind === k
                            ? "bg-pink-500 border-pink-500 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-pink-300",
                        )}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Yöntem</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["cash","card","transfer","wallet"] as OrgPaymentMethod[]).map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                        className={cn(
                          "text-[11px] font-bold py-2 rounded-lg border-2 transition-all",
                          method === m
                            ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300",
                        )}>
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Tutar (₺)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                   className="w-full px-3 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-bold focus:outline-none focus:border-pink-500"
                   placeholder="0" autoFocus />
            {remaining > 0 && kind !== "refund" && (
              <p className="text-[10px] text-slate-400 mt-1">Kalan: <strong>{fmt(remaining)}</strong></p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Not (ops.)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)}
                   placeholder="Açıklama"
                   className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-pink-500" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={busy}
                  className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-500 hover:text-slate-900">
            Vazgeç
          </button>
          <button onClick={submit} disabled={busy}
                  className={cn(
                    "text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5",
                    busy ? "bg-slate-300 dark:bg-slate-700 text-slate-500"
                         : "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-sm",
                  )}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Check className="w-3.5 h-3.5"/>}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}
