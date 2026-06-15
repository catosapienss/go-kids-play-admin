"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Package, Clock, Sparkles, CheckCircle2, History, Repeat, ShoppingBag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import {
  listParentActiveSessions, listParentRecentSessions,
  type ParentBundle,
} from "@/lib/services/parent-portal.service"
import { ParentActiveReservations } from "./parent-active-reservations"
import { ParentPurchaseFlow } from "./parent-purchase-flow"
import { ParentMembershipsCard } from "./parent-memberships-card"
import { type ActiveSession } from "@/types/aktif-oyun"
import type { DbSessionRow } from "@/types/realtime"

// ─── Parent Packages / Membership Screen ─────────────────────────────────────
//
// Gives the parent a single place to see:
//   • Currently-active packages (the live sessions)
//   • Recent past packages (history strip)
//   • Quick summary: total sessions ever + total minutes played + unlimited usage
//
// "Membership" here is a foundation concept — we don't have a separate
// memberships table yet. We surface aggregate behaviour so the parent feels
// the system "knows" them, with room to plug a real loyalty/membership table
// later (e.g. parents_memberships.unlimited_until, monthly_credits, etc).

function fmtMinutes(n: number): string {
  if (n < 60) return `${n} dk`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "short", year: "numeric",
    })
  } catch { return iso }
}

interface Props { bundle: ParentBundle }

export function ParentPackagesScreen({ bundle }: Props) {
  const [active, setActive]     = useState<ActiveSession[]>([])
  const [history, setHistory]   = useState<DbSessionRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [showPurchase, setShowPurchase] = useState(false)
  const [reloadToken,   setReloadToken] = useState(0)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      listParentActiveSessions(bundle.parent.id),
      listParentRecentSessions(bundle.parent.id, 20),
    ])
      .then(([a, h]) => {
        if (cancelled) return
        setActive(a); setHistory(h)
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bundle.parent.id, reconnectToken])

  // Quick aggregates from history.
  const stats = useMemo(() => {
    const total       = history.length
    const totalMin    = history.reduce((s, r) => s + (r.duration_minutes || 0), 0)
    const unlimited   = history.filter((r) => r.duration_minutes === 0).length
    const extensions  = history.filter((r) => (r as DbSessionRow & { extension_count?: number }).extension_count).length
    return { total, totalMin, unlimited, extensions }
  }, [history])

  return (
    <div className="pb-24">
      <ScreenHeader title="Paketler" subtitle="Aktif ve geçmiş paketlerin" />

      {/* Active memberships — banner-style card, hides itself when none */}
      <div className="px-5 mb-4">
        <ParentMembershipsCard parentId={bundle.parent.id} />
      </div>

      {/* New purchase CTA */}
      <div className="px-5 mb-4">
        <button
          type="button"
          onClick={() => setShowPurchase(true)}
          className="w-full rounded-3xl p-4 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-xl shadow-violet-500/30 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold">Yeni Paket Al</p>
            <p className="text-[11px] opacity-80">30 / 60 / 90 dk · Sınırsız — saniyeler içinde</p>
          </div>
          <span className="text-2xl">→</span>
        </button>
      </div>

      {/* Active reservations (pending check-in) */}
      <div className="px-5 mb-4">
        <ParentActiveReservations parentId={bundle.parent.id} reloadToken={reloadToken} />
      </div>

      {/* Stats strip */}
      <div className="px-5">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat label="Toplam Ziyaret"    value={stats.total}                   icon={History}    tone="violet" />
          <Stat label="Toplam Süre"        value={fmtMinutes(stats.totalMin)}   icon={Clock}      tone="blue" />
          <Stat label="Sınırsız Kullanım" value={stats.unlimited}               icon={Sparkles}   tone="fuchsia" />
        </div>
      </div>

      {/* Active packages */}
      <div className="px-5 mt-5">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2">
          Aktif Paketler
        </p>

        {loading ? (
          <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 h-20 animate-pulse" />
        ) : active.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-5 text-center">
            <Package className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Şu an aktif paket yok</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Çocuğun oyuna girdiğinde paketi burada görünecek.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map((s) => <ActivePackageRow key={s.id} session={s} />)}
          </ul>
        )}
      </div>

      {/* Past packages */}
      <div className="px-5 mt-6">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">
            Son Paketler
          </p>
          <span className="text-[10px] text-slate-400">son {history.length}</span>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-5 text-center">
            <Repeat className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
            <p className="text-xs text-slate-500">Henüz paket geçmişi yok</p>
          </div>
        ) : (
          <ul className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {history.map((s) => <PastPackageRow key={s.id} session={s} />)}
          </ul>
        )}
      </div>

      {/* Foundation hint */}
      <div className="px-5 mt-6">
        <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-500/[0.08] dark:to-fuchsia-500/[0.06] border border-violet-200 dark:border-violet-700/40 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Sınırsız üyelik yakında
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Aylık sınırsız oyun paketi ve sadakat ödülleri yakında bu ekranda olacak.
            </p>
          </div>
        </div>
      </div>

      {/* Purchase modal */}
      <ParentPurchaseFlow
        open={showPurchase}
        onClose={() => setShowPurchase(false)}
        bundle={bundle}
        onPurchaseComplete={() => setReloadToken((t) => t + 1)}
      />
    </div>
  )
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-5 pt-5 pb-4">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h1>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

const STAT_TONE: Record<string, { bg: string; fg: string }> = {
  violet:  { bg: "bg-violet-500/10",  fg: "text-violet-600 dark:text-violet-300" },
  blue:    { bg: "bg-blue-500/10",    fg: "text-blue-600 dark:text-blue-300" },
  fuchsia: { bg: "bg-fuchsia-500/10", fg: "text-fuchsia-600 dark:text-fuchsia-300" },
}

function Stat({ label, value, icon: Icon, tone }: {
  label: string
  value: string | number
  icon: typeof History
  tone: keyof typeof STAT_TONE
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-1.5", STAT_TONE[tone].bg, STAT_TONE[tone].fg)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-lg font-black tabular-nums text-slate-900 dark:text-white leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">{label}</p>
    </div>
  )
}

function ActivePackageRow({ session }: { session: ActiveSession }) {
  const isUnlimited = session.totalMinutes === 0
  return (
    <li className={cn(
      "rounded-2xl border bg-gradient-to-br p-4 flex items-center gap-3",
      isUnlimited
        ? "from-fuchsia-500/15 to-purple-500/10 border-fuchsia-300 dark:border-fuchsia-700/50"
        : "from-emerald-500/15 to-teal-500/10  border-emerald-300 dark:border-emerald-700/50",
    )}>
      <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-slate-900/60 flex items-center justify-center flex-shrink-0">
        {isUnlimited
          ? <Sparkles className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-300" />
          : <Clock    className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
          {session.childName}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {isUnlimited ? "Sınırsız paket" : `${session.totalMinutes} dk paket`}
        </p>
      </div>
      <span className={cn(
        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
        isUnlimited
          ? "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300"
          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      )}>
        Aktif
      </span>
    </li>
  )
}

function PastPackageRow({ session }: { session: DbSessionRow }) {
  const isUnlimited = session.duration_minutes === 0
  const completed = session.status === "completed"
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
        completed ? "bg-slate-500/10 text-slate-500" : "bg-violet-500/10 text-violet-600 dark:text-violet-300",
      )}>
        {completed ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
          {session.child_name}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {fmtDate(session.created_at)}
          <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>
          {isUnlimited ? "Sınırsız" : `${session.duration_minutes} dk`}
        </p>
      </div>
      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
        {completed ? "Tamamlandı" : "Açık"}
      </span>
    </li>
  )
}
