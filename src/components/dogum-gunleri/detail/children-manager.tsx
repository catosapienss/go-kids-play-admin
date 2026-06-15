import { UserCheck, UserX, Clock, QrCode, Plus, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Organization, ChildAttendance } from "@/types/organizasyon"

const ATTENDANCE_META: Record<ChildAttendance, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  expected: { label: "Bekleniyor", icon: Clock, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-500/10" },
  arrived: { label: "Geldi", icon: UserCheck, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10" },
  absent: { label: "Gelmedi", icon: UserX, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/10" },
}

const AVATAR_COLORS = [
  "from-violet-400 to-purple-500",
  "from-pink-400 to-rose-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-green-500",
  "from-orange-400 to-amber-500",
  "from-teal-400 to-cyan-500",
]

export function ChildrenManager({ org }: { org: Organization }) {
  const arrived = org.children.filter((c) => c.attendance === "arrived").length
  const expected = org.children.filter((c) => c.attendance === "expected").length
  const absent = org.children.filter((c) => c.attendance === "absent").length
  const extras = org.children.filter((c) => c.isExtra)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Geldi", count: arrived, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
          { label: "Bekleniyor", count: expected, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-500/10" },
          { label: "Gelmedi", count: absent, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10" },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl p-3 text-center", s.bg)}>
            <p className={cn("text-xl font-bold", s.color)}>{s.count}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm">
          <Plus className="w-3.5 h-3.5" />
          Çocuk Ekle
        </button>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-sky-100 dark:bg-sky-500/10 hover:bg-sky-200 dark:hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 rounded-xl text-xs font-semibold transition-colors">
          <QrCode className="w-3.5 h-3.5" />
          QR Oluştur
        </button>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors">
          <Users className="w-3.5 h-3.5" />
          Toplu Giriş
        </button>
      </div>

      {/* Children list */}
      {org.children.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
          <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Çocuk listesi henüz eklenmedi</p>
          <button className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors">
            Liste Ekle
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{org.children.length} çocuk</p>
            {extras.length > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{extras.length} ekstra</span>
            )}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {org.children.map((child, idx) => {
              const meta = ATTENDANCE_META[child.attendance]
              const Icon = meta.icon
              return (
                <div key={child.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm flex-shrink-0", AVATAR_COLORS[idx % AVATAR_COLORS.length])}>
                    {child.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{child.name}</p>
                      {child.isExtra && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded">+Ekstra</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{child.age} yaş{child.parentName ? ` · ${child.parentName}` : ""}</p>
                  </div>
                  <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0", meta.bg, meta.color)}>
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
