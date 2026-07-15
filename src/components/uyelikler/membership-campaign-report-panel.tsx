"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Users, UsersRound, Wallet, Gift, CalendarDays, Sun, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getMembershipCampaignReport, type MembershipCampaignReport,
} from "@/lib/services/campaign.service"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"

// ─── Membership & Campaign Report (Phase 2) ──────────────────────────────────
//
// Distinguishes single vs sibling package sales, membership revenue, and — most
// importantly — separates PAID minutes from GIFTED campaign bonus minutes.
// Bonus minutes are never revenue; they are shown only as a gifted quantity.

type RangeKey = "thisMonth" | "last30" | "thisYear"

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "thisMonth", label: "Bu Ay" },
  { key: "last30",    label: "Son 30 Gün" },
  { key: "thisYear",  label: "Bu Yıl" },
]

function rangeBounds(key: RangeKey): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000) // through end of today
  if (key === "last30") {
    return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to }
  }
  if (key === "thisYear") {
    return { from: new Date(now.getFullYear(), 0, 1), to }
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to }
}

const TL = (n: number) => `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function MembershipCampaignReportPanel() {
  const [range, setRange] = useState<RangeKey>("thisMonth")
  const [data, setData]   = useState<MembershipCampaignReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()
  const { from, to } = useMemo(() => rangeBounds(range), [range])

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    void getMembershipCampaignReport(from, to)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [from, to, reconnectToken])

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
          Üyelik &amp; Kampanya Raporu
        </p>
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                range === r.key
                  ? "bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-300 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {!data && !error && <PanelSkeleton height={180} />}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={Wallet}     tone="emerald" label="Üyelik Geliri"   value={TL(data.membershipRevenue)} hint={`${data.membershipsSold} üyelik satışı`} />
            <Stat icon={Users}      tone="violet"  label="Tekli Üyelik"    value={data.membershipsSingle.toLocaleString("tr-TR")} hint="1 çocuk" />
            <Stat icon={UsersRound} tone="fuchsia" label="Kardeş Üyelik"   value={data.membershipsSibling.toLocaleString("tr-TR")} hint="2 çocuk" />
            <Stat icon={CalendarDays} tone="blue"  label="Kampanya Kullanımı" value={data.campaignSessions.toLocaleString("tr-TR")} hint="Pzt/Çrş hediye" />
          </div>

          {/* Paid vs gifted — the critical revenue-integrity distinction */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">Ücretli Dakika (Gelir)</p>
              </div>
              <p className="text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                {data.campaignPaidMinutes.toLocaleString("tr-TR")} <span className="text-sm font-bold">dk</span>
              </p>
              <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 mt-0.5">Kampanyada satın alınan süre</p>
            </div>
            <div className="rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Gift className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300">Hediye Dakika (Gelir Değil)</p>
              </div>
              <p className="text-2xl font-black tabular-nums text-amber-700 dark:text-amber-300">
                {data.campaignBonusMinutes.toLocaleString("tr-TR")} <span className="text-sm font-bold">dk</span>
              </p>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-0.5">Hediye edilen süre — gelire yansımaz</p>
            </div>
          </div>

          {/* Membership play usage */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Mini icon={CalendarDays} label="Üyelikle Oyun" value={`${data.membershipSessions.toLocaleString("tr-TR")}`} sub="oturum" />
            <Mini icon={Sun}          label="Hafta İçi Ziyaret" value={`${data.membershipWeekdayVisits.toLocaleString("tr-TR")}`} sub="sınırsız" />
            <Mini icon={Clock}        label="Hafta Sonu Süre" value={`${data.membershipWeekendMinutes.toLocaleString("tr-TR")}`} sub="dakika" />
          </div>
        </>
      )}
    </div>
  )
}

const TONE: Record<string, { bg: string; fg: string }> = {
  violet:  { bg: "bg-violet-500/10",  fg: "text-violet-600  dark:text-violet-300"  },
  fuchsia: { bg: "bg-fuchsia-500/10", fg: "text-fuchsia-600 dark:text-fuchsia-300" },
  blue:    { bg: "bg-blue-500/10",    fg: "text-blue-600    dark:text-blue-300"    },
  emerald: { bg: "bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-300" },
}

function Stat({ icon: Icon, tone, label, value, hint }: {
  icon: typeof Users; tone: keyof typeof TONE; label: string; value: string; hint: string
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", TONE[tone].bg, TONE[tone].fg)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white leading-tight">{value}</p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{hint}</p>
    </div>
  )
}

function Mini({ icon: Icon, label, value, sub }: {
  icon: typeof Users; label: string; value: string; sub: string
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-lg font-black tabular-nums text-slate-900 dark:text-white leading-none">
          {value} <span className="text-[10px] font-semibold text-slate-400">{sub}</span>
        </p>
      </div>
    </div>
  )
}
