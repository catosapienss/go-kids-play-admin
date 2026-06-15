"use client"

import { useStaffMetrics } from "@/hooks/use-analytics"
import { PanelSkeleton } from "./dashboard-skeletons"
import { cn } from "@/lib/utils"
import { Users, ArrowRight } from "lucide-react"
import Link from "next/link"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? "?"
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

const PALETTE = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
]

export function StaffAnalyticsPanel() {
  const { data, isLoading } = useStaffMetrics()
  if (isLoading || !data) return <PanelSkeleton height={300} />

  const max = Math.max(1, ...data.map((s) => s.txCount))

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Personel Performansı</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Bugünkü işlemler</p>
          </div>
        </div>
        <Link
          href="/personeller"
          className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
        >
          Detay <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
          Bugün henüz işlem yok.
        </div>
      ) : (
        <div className="space-y-3 flex-1">
          {data.map((s, idx) => (
            <div key={s.staffName} className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-lg bg-gradient-to-br text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0",
                PALETTE[idx % PALETTE.length],
              )}>
                {initials(s.staffName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{s.staffName}</p>
                  <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{s.txCount}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                      style={{ width: `${(s.txCount / max) * 100}%` }}
                    />
                  </div>
                  {s.cancellations > 0 && (
                    <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-md bg-rose-500/10">
                      {s.cancellations} iptal
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
