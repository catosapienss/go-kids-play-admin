import Link from "next/link"
import { Clock, Users, ChevronRight, Cake } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Organization } from "@/types/organizasyon"
import { getPackageById } from "@/lib/organizasyon-data"
import { OrgStatusBadge } from "./org-status-badge"

interface UpcomingEventsProps {
  organizations: Organization[]
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function UpcomingEvents({ organizations }: UpcomingEventsProps) {
  const sorted = [...organizations]
    .filter((o) => o.status === "upcoming" || o.status === "ongoing")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
            <Cake className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Yaklaşan</p>
        </div>
        <span className="text-xs text-slate-500">{sorted.length} etkinlik</span>
      </div>

      {sorted.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-slate-400">Yaklaşan etkinlik yok</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((org) => {
            const pkg = getPackageById(org.packageId)
            const days = daysUntil(org.date)
            return (
              <Link
                key={org.id}
                href={`/dogum-gunleri/${org.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
              >
                <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm flex-shrink-0", pkg?.gradient ?? "from-violet-500 to-purple-600")}>
                  {org.childName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{org.childName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Clock className="w-2.5 h-2.5" />
                      {org.startTime}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Users className="w-2.5 h-2.5" />
                      {org.childCount} çocuk
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {days === 0 ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Bugün</span>
                  ) : days === 1 ? (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Yarın</span>
                  ) : days > 0 ? (
                    <span className="text-[10px] text-slate-500">{days} gün</span>
                  ) : (
                    <OrgStatusBadge status={org.status} />
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
