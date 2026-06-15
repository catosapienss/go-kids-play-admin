import {
  PlusCircle, CreditCard, CheckCircle2, Bell,
  Play, Users, Trophy, XCircle, StickyNote
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Organization, TimelineEventType } from "@/types/organizasyon"

const TIMELINE_META: Record<TimelineEventType, {
  label: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
}> = {
  created: { label: "Oluşturuldu", icon: PlusCircle, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-500/10", border: "border-violet-200 dark:border-violet-500/20" },
  deposit: { label: "Depozito", icon: CreditCard, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  confirmed: { label: "Onaylandı", icon: CheckCircle2, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-500/10", border: "border-sky-200 dark:border-sky-500/20" },
  reminder: { label: "Hatırlatma", icon: Bell, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/20" },
  started: { label: "Başladı", icon: Play, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  children_arrived: { label: "Çocuklar Geldi", icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/10", border: "border-blue-200 dark:border-blue-500/20" },
  completed: { label: "Tamamlandı", icon: Trophy, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-500/10", border: "border-violet-200 dark:border-violet-500/20" },
  cancelled: { label: "İptal", icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/10", border: "border-red-200 dark:border-red-500/20" },
  note: { label: "Not", icon: StickyNote, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", border: "border-slate-200 dark:border-slate-700" },
}

export function TimelineSection({ org }: { org: Organization }) {
  return (
    <div className="space-y-1">
      {org.timeline.map((event, idx) => {
        const meta = TIMELINE_META[event.type]
        const Icon = meta.icon
        const isLast = idx === org.timeline.length - 1

        return (
          <div key={event.id} className="flex gap-3">
            {/* Connector */}
            <div className="flex flex-col items-center">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border", meta.bg, meta.border)}>
                <Icon className={cn("w-4 h-4", meta.color)} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1 min-h-[16px]" />}
            </div>

            {/* Content */}
            <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{event.title}</p>
                  {event.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{event.description}</p>
                  )}
                  {event.staffName && (
                    <p className="text-[10px] text-slate-400 mt-1">— {event.staffName}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400 tabular-nums">{event.date.split(" ")[0].slice(5).replace("-", "/")}</p>
                  {event.date.split(" ")[1] && (
                    <p className="text-[10px] text-slate-400">{event.date.split(" ")[1]}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
