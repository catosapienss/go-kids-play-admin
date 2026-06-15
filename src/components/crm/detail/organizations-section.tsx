import { Cake, CalendarCheck, CalendarClock, Users, Ban, PartyPopper } from "lucide-react"
import type { Customer } from "@/types/crm"
import { cn } from "@/lib/utils"

const TYPE_META = {
  birthday: { label: "Doğum Günü", icon: Cake, color: "from-pink-500 to-rose-500" },
  event: { label: "Etkinlik", icon: PartyPopper, color: "from-violet-500 to-purple-500" },
  reservation: { label: "Rezervasyon", icon: CalendarClock, color: "from-sky-500 to-blue-500" },
}

const STATUS_META = {
  completed: { label: "Tamamlandı", icon: CalendarCheck, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10" },
  upcoming: { label: "Yaklaşıyor", icon: CalendarClock, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-500/10" },
  cancelled: { label: "İptal", icon: Ban, color: "text-red-500 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/10" },
}

export function OrganizationsSection({ customer }: { customer: Customer }) {
  if (customer.organizations.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
        <Cake className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Organizasyon kaydı yok</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {customer.organizations.map((org) => {
        const typeMeta = TYPE_META[org.type]
        const statusMeta = STATUS_META[org.status]
        const TypeIcon = typeMeta.icon
        const StatusIcon = statusMeta.icon

        return (
          <div key={org.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Top gradient bar */}
            <div className={cn("h-2 bg-gradient-to-r", typeMeta.color)} />
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0", typeMeta.color)}>
                  <TypeIcon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{org.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{typeMeta.label}</p>
                </div>
                <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0", statusMeta.bg, statusMeta.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {statusMeta.label}
                </div>
              </div>

              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <CalendarCheck className="w-3.5 h-3.5" />
                  {org.date.slice(0, 10).replace(/-/g, "/")}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {org.participants} kişi
                </div>
                <div className="ml-auto font-bold text-slate-900 dark:text-white text-sm">
                  ₺{org.amount.toLocaleString("tr-TR")}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
