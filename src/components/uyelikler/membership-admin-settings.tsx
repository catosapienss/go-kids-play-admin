"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { X, Loader2, Save, Coffee, Tag, CalendarClock, Plus, Power } from "lucide-react"
import { toast } from "sonner"
import { cn, formatTRY } from "@/lib/utils"
import { listPackages, upsertMembershipPackage } from "@/lib/services/membership.service"
import { listCampaigns, upsertCampaign, type Campaign } from "@/lib/services/campaign.service"
import type { MembershipPackage } from "@/types/membership"

// ─── Owner-only membership package + campaign config (migration 035) ─────────
//
// Admin/super_admin can edit package price/rules/Brewmood and create/edit/toggle
// campaigns. All writes go through the owner-gated upsert RPCs (staff calls fail
// server-side with not_authorized).

const WEEKDAYS = [
  { v: 1, l: "Pzt" }, { v: 2, l: "Sal" }, { v: 3, l: "Çrş" }, { v: 4, l: "Prş" },
  { v: 5, l: "Cum" }, { v: 6, l: "Cmt" }, { v: 0, l: "Paz" },
]

interface Props { open: boolean; onClose: () => void }

export function MembershipAdminSettings({ open, onClose }: Props) {
  const [tab, setTab] = useState<"packages" | "campaigns">("packages")
  return !open ? null : (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white flex-1">Üyelik & Kampanya Ayarları</p>
          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <TabBtn active={tab === "packages"} onClick={() => setTab("packages")}>Paketler</TabBtn>
            <TabBtn active={tab === "campaigns"} onClick={() => setTab("campaigns")}>Kampanyalar</TabBtn>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 ml-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "packages" ? <PackagesEditor /> : <CampaignsEditor />}
        </div>
      </div>
    </div>
  )
}

// ─── Packages ────────────────────────────────────────────────────────────────

function PackagesEditor() {
  const [rows, setRows] = useState<MembershipPackage[] | null>(null)
  const refresh = useCallback(async () => setRows(await listPackages()), [])
  useEffect(() => { void refresh() }, [refresh])

  if (rows === null) return <Center><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></Center>
  return (
    <div className="space-y-3">
      {rows.map((p) => <PackageCard key={p.id} pkg={p} onSaved={refresh} />)}
    </div>
  )
}

function PackageCard({ pkg, onSaved }: { pkg: MembershipPackage; onSaved: () => void }) {
  const [d, setD] = useState(pkg)
  const [busy, setBusy] = useState(false)
  useEffect(() => setD(pkg), [pkg])
  const dirty = useMemo(() => JSON.stringify(d) !== JSON.stringify(pkg), [d, pkg])

  async function save() {
    setBusy(true)
    try { await upsertMembershipPackage(d); toast.success("Paket güncellendi"); onSaved() }
    catch (e) { toast.error(e instanceof Error ? e.message : "Kaydedilemedi") }
    finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })}
          className="text-sm font-bold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 outline-none flex-1" />
        <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 cursor-pointer">
          <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /> Aktif
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Field label="Fiyat (₺)"><NumIn value={d.price} onChange={(v) => setD({ ...d, price: v })} /></Field>
        <Field label="Çocuk sayısı"><NumIn value={d.includedChildren} onChange={(v) => setD({ ...d, includedChildren: v })} /></Field>
        <Field label="Süre (gün)"><NumIn value={d.validityDays} onChange={(v) => setD({ ...d, validityDays: v })} /></Field>
        <Field label="Hafta sonu dk"><NumIn value={d.weekendDailyMinutes} onChange={(v) => setD({ ...d, weekendDailyMinutes: v })} /></Field>
        <Field label="Brewmood %"><NumIn value={d.brewmoodDiscountPct} onChange={(v) => setD({ ...d, brewmoodDiscountPct: v })} /></Field>
        <Field label="Hafta içi sınırsız">
          <label className="inline-flex items-center gap-1 h-8 text-xs">
            <input type="checkbox" checked={d.weekdayUnlimited} onChange={(e) => setD({ ...d, weekdayUnlimited: e.target.checked })} /> Evet
          </label>
        </Field>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><Coffee className="w-3 h-3" />%{d.brewmoodDiscountPct} Brewmood · {formatTRY(d.price)}</span>
        <button onClick={save} disabled={!dirty || busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Kaydet
        </button>
      </div>
    </div>
  )
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

function CampaignsEditor() {
  const [rows, setRows] = useState<Campaign[] | null>(null)
  const refresh = useCallback(async () => setRows(await listCampaigns()), [])
  useEffect(() => { void refresh() }, [refresh])

  function addNew() {
    setRows((prev) => [{
      id: "", name: "Yeni Kampanya", eligibleWeekdays: [1, 3], eligiblePackageMinutes: 60, bonusMinutes: 30,
      startsOn: null, endsOn: null, active: true, forNewRegistrations: true, forExtensions: false, combinableWithMemberships: false,
    }, ...(prev ?? [])])
  }

  if (rows === null) return <Center><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></Center>
  return (
    <div className="space-y-3">
      <button onClick={addNew} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-violet-400 text-violet-600 dark:text-violet-400 text-xs font-bold hover:bg-violet-50 dark:hover:bg-violet-500/10">
        <Plus className="w-3.5 h-3.5" /> Yeni kampanya
      </button>
      {rows.map((c, i) => <CampaignCard key={c.id || `new${i}`} campaign={c} onSaved={refresh} />)}
    </div>
  )
}

function CampaignCard({ campaign, onSaved }: { campaign: Campaign; onSaved: () => void }) {
  const [d, setD] = useState(campaign)
  const [busy, setBusy] = useState(false)
  useEffect(() => setD(campaign), [campaign])

  async function save() {
    setBusy(true)
    try { await upsertCampaign({ ...d, id: d.id || null }); toast.success("Kampanya kaydedildi"); onSaved() }
    catch (e) { toast.error(e instanceof Error ? e.message : "Kaydedilemedi") }
    finally { setBusy(false) }
  }
  function toggleDay(v: number) {
    setD((p) => ({ ...p, eligibleWeekdays: p.eligibleWeekdays.includes(v) ? p.eligibleWeekdays.filter((x) => x !== v) : [...p.eligibleWeekdays, v].sort() }))
  }

  return (
    <div className={cn("rounded-2xl border p-4", d.active ? "border-slate-200 dark:border-slate-800" : "border-slate-200 dark:border-slate-800 opacity-70")}>
      <div className="flex items-center gap-2 mb-2">
        <Tag className="w-4 h-4 text-violet-500 flex-shrink-0" />
        <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })}
          className="text-sm font-bold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 outline-none flex-1" />
        <button onClick={() => setD({ ...d, active: !d.active })} title={d.active ? "Aktif" : "Pasif"}
          className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold", d.active ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
          <Power className="w-3 h-3" />{d.active ? "Aktif" : "Pasif"}
        </button>
      </div>
      <div className="mb-2">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Geçerli günler</p>
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((w) => (
            <button key={w.v} onClick={() => toggleDay(w.v)}
              className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border", d.eligibleWeekdays.includes(w.v) ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-300" : "border-slate-200 dark:border-slate-700 text-slate-500")}>{w.l}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Field label="Paket dk"><NumIn value={d.eligiblePackageMinutes} onChange={(v) => setD({ ...d, eligiblePackageMinutes: v })} /></Field>
        <Field label="Bonus dk"><NumIn value={d.bonusMinutes} onChange={(v) => setD({ ...d, bonusMinutes: v })} /></Field>
        <Field label="Başlangıç"><DateIn value={d.startsOn} onChange={(v) => setD({ ...d, startsOn: v })} /></Field>
        <Field label="Bitiş"><DateIn value={d.endsOn} onChange={(v) => setD({ ...d, endsOn: v })} /></Field>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]">
        <Toggle label="Yeni kayıtlara" checked={d.forNewRegistrations} onChange={(b) => setD({ ...d, forNewRegistrations: b })} />
        <Toggle label="Uzatmalara" checked={d.forExtensions} onChange={(b) => setD({ ...d, forExtensions: b })} />
        <Toggle label="Üyelikle birleşir" checked={d.combinableWithMemberships} onChange={(b) => setD({ ...d, combinableWithMemberships: b })} />
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />{d.eligiblePackageMinutes} dk → +{d.bonusMinutes} dk hediye</span>
        <button onClick={save} disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Kaydet
        </button>
      </div>
    </div>
  )
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("px-3 py-1 rounded-md text-xs font-bold", active ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500")}>{children}</button>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">{label}</p>{children}</div>
}
function NumIn({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm tabular-nums text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30" />
}
function DateIn({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
    className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30" />
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return <label className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>
}
function Center({ children }: { children: React.ReactNode }) { return <div className="py-10 flex justify-center">{children}</div> }
