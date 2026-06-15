import { Cake, TrendingUp, Clock, CheckCircle2 } from "lucide-react"
import type { Organization } from "@/types/organizasyon"

interface OrgStatsBarProps {
  orgs: Organization[]
}

export function OrgStatsBar({ orgs }: OrgStatsBarProps) {
  const upcoming = orgs.filter((o) => o.status === "upcoming").length
  const ongoing = orgs.filter((o) => o.status === "ongoing").length
  const completed = orgs.filter((o) => o.status === "completed").length
  const totalRevenue = orgs.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.paidAmount, 0)

  const stats = [
    { label: "Yaklaşan", value: upcoming, icon: Clock, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-500/10" },
    { label: "Devam Eden", value: ongoing, icon: Cake, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { label: "Tamamlanan", value: completed, icon: CheckCircle2, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-500/10" },
    { label: "Toplam Gelir", value: `₺${totalRevenue.toLocaleString("tr-TR")}`, icon: TrendingUp, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10" },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      {stats.map((s) => {
        const Icon = s.icon
        return (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                <Icon className={`w-4.5 h-4.5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{s.value}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
