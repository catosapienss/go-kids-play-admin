"use client"

import { cn } from "@/lib/utils"
import {
  Baby,
  Users,
  Clock,
  Sparkles,
  TrendingUp,
  Banknote,
  CreditCard,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { useDashboardMetrics } from "@/hooks/use-analytics"
import { KpiSkeleton } from "./dashboard-skeletons"

interface KpiCardProps {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  tone: "violet" | "emerald" | "amber" | "rose" | "blue" | "indigo" | "slate" | "fuchsia"
  pulse?: boolean
}

const TONES: Record<KpiCardProps["tone"], { icon: string; ring: string; valueFg: string }> = {
  violet:  { icon: "bg-violet-500/10  text-violet-600  dark:text-violet-300",  ring: "ring-violet-500/20",  valueFg: "text-violet-700  dark:text-violet-200"  },
  emerald: { icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", ring: "ring-emerald-500/20", valueFg: "text-emerald-700 dark:text-emerald-200" },
  amber:   { icon: "bg-amber-500/10   text-amber-600   dark:text-amber-300",   ring: "ring-amber-500/20",   valueFg: "text-amber-700   dark:text-amber-200"   },
  rose:    { icon: "bg-rose-500/10    text-rose-600    dark:text-rose-300",    ring: "ring-rose-500/20",    valueFg: "text-rose-700    dark:text-rose-200"    },
  blue:    { icon: "bg-blue-500/10    text-blue-600    dark:text-blue-300",    ring: "ring-blue-500/20",    valueFg: "text-blue-700    dark:text-blue-200"    },
  indigo:  { icon: "bg-indigo-500/10  text-indigo-600  dark:text-indigo-300",  ring: "ring-indigo-500/20",  valueFg: "text-indigo-700  dark:text-indigo-200"  },
  slate:   { icon: "bg-slate-500/10   text-slate-700   dark:text-slate-300",   ring: "ring-slate-500/20",   valueFg: "text-slate-900   dark:text-white"       },
  fuchsia: { icon: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300", ring: "ring-fuchsia-500/20", valueFg: "text-fuchsia-700 dark:text-fuchsia-200" },
}

function KpiCard({ label, value, hint, icon: Icon, tone, pulse }: KpiCardProps) {
  const t = TONES[tone]
  return (
    <div className={cn(
      "group relative rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900",
      "p-3 transition-shadow hover:shadow-sm",
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", t.icon)}>
          <Icon className="w-3.5 h-3.5" />
          {pulse && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
          )}
        </div>
        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>
      <div className={cn("text-xl font-bold tabular-nums tracking-tight", t.valueFg)}>
        {value}
      </div>
      {hint && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
          {hint}
        </p>
      )}
    </div>
  )
}

function formatTRY(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

export function KpiBar() {
  const { data, isLoading } = useDashboardMetrics()

  if (isLoading || !data) return <KpiSkeleton />

  const cards: KpiCardProps[] = [
    { label: "Bugün Giriş",   value: data.todayEntries,           hint: "Toplam giriş",         icon: Baby,         tone: "violet" },
    { label: "Aktif Oyun",    value: data.activeSessions,         hint: `${data.unlimitedActive} sınırsız`, icon: Users,        tone: "indigo" },
    { label: "Bitiyor",       value: data.expiringSoon,           hint: "≤ 10 dakika",          icon: Clock,        tone: "amber", pulse: data.expiringSoon > 0 },
    { label: "Sınırsız",      value: data.unlimitedActive,        hint: "Aktif üyeler",         icon: Sparkles,     tone: "fuchsia" },
    { label: "Günlük Ciro",   value: formatTRY(data.netRevenue),  hint: data.totalRefunded > 0 ? `${formatTRY(data.totalRefunded)} iade` : "Net gelir", icon: TrendingUp, tone: "emerald" },
    { label: "Nakit",         value: formatTRY(data.totalCash),   hint: "Bugünkü toplam",        icon: Banknote,     tone: "emerald" },
    { label: "Kart",          value: formatTRY(data.totalCard),   hint: "Bugünkü toplam",        icon: CreditCard,   tone: "blue" },
    { label: "Cüzdan",        value: formatTRY(data.totalWallet), hint: `${formatTRY(data.walletLoaded)} yükleme`, icon: Wallet, tone: "violet" },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {cards.map((c) => <KpiCard key={c.label} {...c} />)}
    </div>
  )
}
