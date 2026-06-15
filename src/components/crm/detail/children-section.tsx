import { Baby, TrendingUp, Star, Calendar } from "lucide-react"
import type { Customer } from "@/types/crm"
import { cn } from "@/lib/utils"

const CHILD_COLORS = [
  "from-violet-400 to-purple-500",
  "from-pink-400 to-rose-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-green-500",
]

export function ChildrenSection({ customer }: { customer: Customer }) {
  if (customer.children.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
        <Baby className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Kayıtlı çocuk yok</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {customer.children.map((child, idx) => (
        <div key={child.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          {/* Header */}
          <div className={cn("bg-gradient-to-r p-4 relative overflow-hidden", CHILD_COLORS[idx % CHILD_COLORS.length])}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-white/10 -translate-y-4 translate-x-4" />
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center text-white font-bold text-base">
                {child.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-white">{child.name}</p>
                <p className="text-white/75 text-xs">{child.age} yaş</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="flex justify-center mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{child.totalVisits}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Ziyaret</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-1">
                <Star className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">{child.favoritePackage}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Favori</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <p className="text-[10px] font-bold text-slate-900 dark:text-white">{child.lastVisit.slice(5).replace("-", "/")}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Son geliş</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
