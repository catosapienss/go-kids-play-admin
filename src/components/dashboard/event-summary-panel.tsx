"use client"

import { useEventSummary } from "@/hooks/use-analytics"
import { PanelSkeleton } from "./dashboard-skeletons"
import { Cake, Calendar, ArrowRight } from "lucide-react"
import Link from "next/link"

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "short", weekday: "short",
    })
  } catch {
    return iso
  }
}

export function EventSummaryPanel() {
  const { data, isLoading } = useEventSummary()
  if (isLoading || !data) return <PanelSkeleton height={300} />

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center">
            <Cake className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Doğum Günleri & Organizasyon</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Yaklaşan etkinlikler</p>
          </div>
        </div>
        <Link
          href="/dogum-gunleri"
          className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
        >
          Tümü <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Today summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/5 border border-pink-200/50 dark:border-pink-900/30 p-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-pink-600 dark:text-pink-400">Bugün</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">{data.todayBirthdays}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">doğum günü</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/5 border border-violet-200/50 dark:border-violet-900/30 p-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400">Bu Hafta</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">{data.weeklyReservations}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">rezervasyon</p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2">
          Yaklaşan Organizasyonlar
        </p>
        {data.upcomingOrgs.length === 0 ? (
          <div className="flex items-center justify-center h-full py-6 text-center">
            <div>
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-400 dark:text-slate-500">Yaklaşan organizasyon yok.</p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.upcomingOrgs.slice(0, 4).map((o, i) => (
              <li key={i} className="flex items-center gap-3 py-1.5">
                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-pink-500 to-violet-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{o.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{fmtDate(o.date)} · {o.childCount} çocuk</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
