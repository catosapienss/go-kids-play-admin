import Link from "next/link"
import { cn, formatNumberTR } from "@/lib/utils"
import type { StaffMember } from "@/types/personel"

const ROLE_META = {
  admin: { label: "Admin", color: "text-slate-100 bg-slate-700 dark:bg-slate-600", dot: "bg-slate-400" },
  manager: { label: "Yönetici", color: "text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-500/20", dot: "bg-violet-500" },
  cashier: { label: "Kasiyer", color: "text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/20", dot: "bg-sky-500" },
}

const STATUS_META = {
  active: { label: "Aktif", color: "text-emerald-700 dark:text-emerald-400", ring: "bg-emerald-400", pulse: true },
  break: { label: "Molada", color: "text-amber-700 dark:text-amber-400", ring: "bg-amber-400", pulse: false },
  offline: { label: "Çevrimdışı", color: "text-slate-500", ring: "bg-slate-400", pulse: false },
}

const AVATAR_GRADIENTS: Record<string, string> = {
  admin: "from-slate-700 to-slate-900",
  manager: "from-violet-500 to-purple-700",
  cashier: "from-sky-500 to-blue-600",
}

export function StaffCard({ staff }: { staff: StaffMember }) {
  const role = ROLE_META[staff.role]
  const status = STATUS_META[staff.status]

  const avatarGrad = staff.id === "s_004"
    ? "from-emerald-500 to-teal-600"
    : AVATAR_GRADIENTS[staff.role]

  return (
    <Link href={`/personeller/${staff.id}`} className="group block">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-200 h-full">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          {/* Avatar */}
          <div className={cn("w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-sm", avatarGrad)}>
            {staff.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{staff.name}</p>
            <span className={cn("inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg mt-1", role.color)}>
              {role.label}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className={cn("w-2.5 h-2.5 rounded-full", status.ring)} />
              {status.pulse && (
                <span className={cn("absolute w-2.5 h-2.5 rounded-full animate-ping opacity-60", status.ring)} />
              )}
            </div>
            <span className={cn("text-[10px] font-semibold", status.color)}>{status.label}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "İşlem", value: staff.todayTxCount, color: "text-slate-900 dark:text-white" },
            { label: "İptal", value: staff.todayCancelCount, color: staff.todayCancelCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white" },
            { label: "₺", value: formatNumberTR(Math.round(staff.todayRevenue)), color: "text-emerald-600 dark:text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
              <p className={cn("text-base font-bold tabular-nums leading-tight", s.color)}>{s.value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Giriş: {staff.loginTime}</span>
          <span>{staff.lastActivity}</span>
        </div>

        {/* Hover CTA */}
        <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-center py-1.5 bg-violet-50 dark:bg-violet-500/10 rounded-xl text-xs font-semibold text-violet-600 dark:text-violet-400">
            Profil Görüntüle →
          </div>
        </div>
      </div>
    </Link>
  )
}

export function StaffCardSkeleton() {

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        </div>
        <div className="w-12 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-xl h-12" />
        ))}
      </div>
      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full" />
    </div>
  )
}
