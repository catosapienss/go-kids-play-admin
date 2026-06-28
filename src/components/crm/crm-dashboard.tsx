"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Users, UserPlus, Repeat, CalendarCheck, Search, X, Loader2,
  Phone, Baby, Crown, Cake, BadgeCheck, ChevronRight, Hash, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { listCustomers, getCrmStats, type CrmTableRow, type CrmStats } from "@/lib/services/crm-dashboard.service"
import { CustomerProfileSheet } from "./customer-profile-sheet"

// ─── CRM Dashboard ──────────────────────────────────────────────────────────
//
// Production-grade customer management surface that replaces the bare search
// palette. Three regions stack top-to-bottom:
//
//   1. Stats strip      — Total / New This Month / Returning / Today
//   2. Search bar       — debounced; matches name, phone, child name (RPC)
//   3. Customer table   — Customer ID · Child · Parent · Phone · Last Visit · Visits · Badges
//
// Click any row → existing CustomerProfileSheet slides in from the right.
// Read-only with respect to operational data — every query is a SELECT.

function fmtPhone(p: string): string {
  if (!p) return "—"
  const digits = p.replace(/\D/g, "")
  if (digits.length === 11) return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7,9)} ${digits.slice(9)}`
  return p
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d <= 0)  return "Bugün"
  if (d === 1) return "Dün"
  if (d < 7)   return `${d} gün önce`
  if (d < 30)  return `${Math.floor(d / 7)} hafta önce`
  if (d < 365) return `${Math.floor(d / 30)} ay önce`
  return `${Math.floor(d / 365)} yıl önce`
}

function lastVisitTone(iso: string | null): string {
  if (!iso) return "text-slate-400"
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d <= 1)  return "text-emerald-600 dark:text-emerald-400"
  if (d <= 7)  return "text-sky-600     dark:text-sky-400"
  if (d <= 30) return "text-amber-600   dark:text-amber-400"
  return "text-rose-500"
}

export function CrmDashboard() {
  const [search, setSearch]   = useState("")
  const [debounced, setDebounced] = useState("")
  const [rows, setRows]       = useState<CrmTableRow[] | null>(null)
  const [stats, setStats]     = useState<CrmStats | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [openId, setOpenId]   = useState<string | null>(null)

  // ── Debounce search input (200ms — feels instant while batching keystrokes)
  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 200)
    return () => clearTimeout(h)
  }, [search])

  // ── Reload table whenever the debounced search changes
  useEffect(() => {
    let cancelled = false
    setRows(null); setError(null)
    listCustomers({ search: debounced, limit: 300 })
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [debounced])

  // ── Stats load once on mount (cheap head-only counts)
  useEffect(() => {
    let cancelled = false
    getCrmStats()
      .then((s) => { if (!cancelled) setStats(s) })
      .catch(() => { /* non-fatal — table still works */ })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">

      {/* ─── Stats strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Toplam Müşteri"     value={stats?.total}        icon={Users}         tone="violet"  />
        <StatCard label="Bu Ay Yeni"         value={stats?.newThisMonth} icon={UserPlus}      tone="emerald" />
        <StatCard label="Tekrar Eden"        value={stats?.returning}    icon={Repeat}        tone="sky"     />
        <StatCard label="Bugün Ziyaret"      value={stats?.today}        icon={CalendarCheck} tone="amber"   />
      </div>

      {/* ─── Search ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 ml-1.5" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Müşteri ID, Çocuk Adı, Veli Adı veya Telefon ile ara…"
          className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
          autoFocus
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Temizle"
            className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {rows === null && !error && (
          <Loader2 className="w-4 h-4 animate-spin text-violet-500 mr-1" />
        )}
        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 tabular-nums">
          {rows?.length ?? 0} kayıt
        </div>
      </div>

      {/* ─── Table ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Th><span className="inline-flex items-center gap-1"><Hash className="w-3 h-3" />Müşteri ID</span></Th>
                <Th>Çocuk</Th>
                <Th>Veli</Th>
                <Th>Telefon</Th>
                <Th>Son Ziyaret</Th>
                <Th className="text-right">Toplam Ziyaret</Th>
                <Th>Etiketler</Th>
                <Th className="pr-3" />
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr><td colSpan={8} className="py-10 text-center text-rose-500 text-sm">{error}</td></tr>
              ) : rows === null ? (
                <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></td></tr>
              ) : rows.length === 0 ? (
                <EmptyRow searching={debounced.length >= 2} />
              ) : rows.map((c) => (
                <CustomerRow key={c.id} c={c} onOpen={() => setOpenId(c.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerProfileSheet
        parentId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 font-bold whitespace-nowrap", className)}>{children}</th>
}

interface RowProps { c: CrmTableRow; onOpen: () => void }
function CustomerRow({ c, onOpen }: RowProps) {
  const hasMembership = c.tags.includes("unlimited") || c.tags.includes("membership")
  const isBirthday    = c.tags.includes("organization") || c.tags.includes("birthday")

  return (
    <tr
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen() }}
      className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-violet-50/40 dark:hover:bg-violet-500/[0.05] cursor-pointer transition-colors group"
    >
      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
        {c.shortId}
      </td>

      <td className="px-3 py-2.5">
        {c.firstChild ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <Baby className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">{c.firstChild}</span>
            {c.otherChildren.length > 0 && (
              <span
                title={c.otherChildren.join(", ")}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 flex-shrink-0"
              >
                +{c.otherChildren.length}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">çocuk kayıtlı değil</span>
        )}
      </td>

      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">{c.fullName}</span>
          {c.isVip && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
        </div>
      </td>

      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1 text-[12.5px] text-slate-600 dark:text-slate-300 tabular-nums">
          <Phone className="w-3 h-3 text-slate-400" />
          {fmtPhone(c.phone)}
        </span>
      </td>

      <td className={cn("px-3 py-2.5 text-[12.5px] font-semibold tabular-nums whitespace-nowrap", lastVisitTone(c.lastVisitAt ?? c.lastSessionAt))}>
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3 opacity-60" />
          {fmtRelative(c.lastVisitAt ?? c.lastSessionAt)}
        </span>
      </td>

      <td className="px-3 py-2.5 text-right">
        <span className="inline-block min-w-[2ch] tabular-nums font-bold text-slate-900 dark:text-white">{c.visitCount}</span>
        <span className="text-[10px] text-slate-400 ml-1">ziyaret</span>
      </td>

      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 flex-wrap">
          {c.isVip && <Badge tone="amber" icon={Crown}>VIP</Badge>}
          {hasMembership && <Badge tone="fuchsia" icon={BadgeCheck}>Üyelik</Badge>}
          {isBirthday && <Badge tone="pink" icon={Cake}>Doğum Günü</Badge>}
        </div>
      </td>

      <td className="px-3 py-2.5 pr-3 text-right">
        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-violet-500 inline-block" />
      </td>
    </tr>
  )
}

function EmptyRow({ searching }: { searching: boolean }) {
  return (
    <tr>
      <td colSpan={8} className="py-12 text-center">
        <div className="inline-flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Baby className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {searching ? "Sonuç bulunamadı" : "Müşteri yok"}
          </p>
          <p className="text-xs text-slate-400">
            {searching ? "Farklı bir terim deneyin" : "Hızlı Kayıt'tan müşteri ekleyebilirsiniz"}
          </p>
        </div>
      </td>
    </tr>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, tone,
}: {
  label: string
  value: number | undefined
  icon: typeof Users
  tone: "violet" | "emerald" | "sky" | "amber"
}) {
  const tones: Record<typeof tone, { bg: string; fg: string }> = {
    violet:  { bg: "bg-violet-100  dark:bg-violet-500/10",  fg: "text-violet-600  dark:text-violet-300" },
    emerald: { bg: "bg-emerald-100 dark:bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-300" },
    sky:     { bg: "bg-sky-100     dark:bg-sky-500/10",     fg: "text-sky-600     dark:text-sky-300" },
    amber:   { bg: "bg-amber-100   dark:bg-amber-500/10",   fg: "text-amber-600   dark:text-amber-300" },
  }
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", tones[tone].bg)}>
        <Icon className={cn("w-5 h-5", tones[tone].fg)} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white leading-none mt-0.5 tabular-nums">
          {value === undefined ? <span className="inline-block w-10 h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /> : value.toLocaleString("tr-TR")}
        </p>
      </div>
    </div>
  )
}

// ── Badge ────────────────────────────────────────────────────────────────
function Badge({ tone, icon: Icon, children }: {
  tone: "amber" | "fuchsia" | "pink"
  icon: typeof Crown
  children: React.ReactNode
}) {
  const tones: Record<typeof tone, string> = {
    amber:   "bg-amber-100   dark:bg-amber-500/15   text-amber-700   dark:text-amber-300",
    fuchsia: "bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    pink:    "bg-pink-100    dark:bg-pink-500/15    text-pink-700    dark:text-pink-300",
  }
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded", tones[tone])}>
      <Icon className="w-2.5 h-2.5" />
      {children}
    </span>
  )
}
