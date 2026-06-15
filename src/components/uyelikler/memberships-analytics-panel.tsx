"use client"

import { useEffect, useState } from "react"
import {
  Sparkles, Pause, AlertTriangle, Hourglass, CreditCard, Ticket, Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getMembershipAnalytics, type MembershipAnalytics,
} from "@/lib/services/membership.service"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"

// ─── Memberships Analytics Panel ──────────────────────────────────────────────
//
// 4-up KPI row used on the admin /uyelikler page AND the main dashboard.
// Branch-scoped through RLS — super_admin "All branches" mode sums across.

const TONE: Record<string, { bg: string; fg: string }> = {
  violet:  { bg: "bg-violet-500/10",  fg: "text-violet-600  dark:text-violet-300"  },
  fuchsia: { bg: "bg-fuchsia-500/10", fg: "text-fuchsia-600 dark:text-fuchsia-300" },
  blue:    { bg: "bg-blue-500/10",    fg: "text-blue-600    dark:text-blue-300"    },
  amber:   { bg: "bg-amber-500/10",   fg: "text-amber-600   dark:text-amber-300"   },
  emerald: { bg: "bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-300" },
}

interface Props {
  /** Show only the headline KPI row (4 tiles, for dashboard).
   *  Default false → also renders the breakdown by type. */
  compact?: boolean
}

export function MembershipsAnalyticsPanel({ compact }: Props) {
  const [data, setData]     = useState<MembershipAnalytics | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setError(null)
    void getMembershipAnalytics()
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [reconnectToken])

  if (!data && !error) return <PanelSkeleton height={compact ? 110 : 220} />
  if (error)           return <EmptyState title="Üyelik istatistiği okunamadı" body={error} tone="danger" />
  if (!data) return null

  const headline = [
    { label: "Aktif Üyelik",     value: data.activeCount,     hint: `${data.total} toplam`,    icon: Users,         tone: "violet"  },
    { label: "Sınırsız Aktif",   value: data.unlimitedActive, hint: "pauseable",                icon: Sparkles,      tone: "fuchsia" },
    { label: "Duraklatılan",     value: data.pausedCount,     hint: "iade beklemiyor",          icon: Pause,         tone: "amber"   },
    { label: "Yakında Bitecek",  value: data.expiringSoon,    hint: "≤ 7 gün",                  icon: AlertTriangle, tone: "amber"   },
  ] as const

  if (compact) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {headline.map((k) => <Tile key={k.label} {...k} />)}
      </div>
    )
  }

  // Full panel: headline + breakdown by type + status counts
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {headline.map((k) => <Tile key={k.label} {...k} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Üyelik Türleri">
          <Row icon={Sparkles}    label="Sınırsız"     value={data.unlimitedActive} tone="fuchsia" />
          <Row icon={CreditCard}  label="Aylık"        value={data.monthlyActive}   tone="violet"  />
          <Row icon={Ticket}      label="Kontörlü"     value={data.punchActive}     tone="blue"    />
        </Card>
        <Card title="Statü Dağılımı">
          <Row icon={Users}       label="Aktif"        value={data.activeCount}     tone="emerald" />
          <Row icon={Pause}       label="Duraklatıldı" value={data.pausedCount}     tone="amber"   />
          <Row icon={Hourglass}   label="Süresi Doldu" value={data.expiredCount}    tone="violet"  />
        </Card>
      </div>
    </div>
  )
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function Tile({ label, value, hint, icon: Icon, tone }: {
  label: string
  value: number
  hint: string
  icon: typeof Sparkles
  tone: keyof typeof TONE
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", TONE[tone].bg, TONE[tone].fg)}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>
      <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-white leading-tight">
        {value.toLocaleString("tr-TR")}
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{hint}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-4">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2">{title}</p>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {children}
      </ul>
    </div>
  )
}

function Row({ icon: Icon, label, value, tone }: {
  icon: typeof Sparkles
  label: string
  value: number
  tone: keyof typeof TONE
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", TONE[tone].bg, TONE[tone].fg)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">{label}</span>
      <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
        {value.toLocaleString("tr-TR")}
      </span>
    </li>
  )
}
