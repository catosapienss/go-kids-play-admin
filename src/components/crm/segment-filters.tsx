"use client"

import { Crown, TrendingUp, Clock, UserPlus, Wallet, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SegmentFilter, Customer } from "@/types/crm"
import { daysSinceLastVisit } from "@/lib/crm-data"

interface SegmentFiltersProps {
  activeFilter: SegmentFilter
  onChange: (f: SegmentFilter) => void
  customers: Customer[]
}

export function SegmentFilters({ activeFilter, onChange, customers }: SegmentFiltersProps) {
  const counts: Record<SegmentFilter, number> = {
    all: customers.length,
    vip: customers.filter((c) => c.isVip).length,
    frequent: customers.filter((c) => c.totalVisits >= 20).length,
    inactive: customers.filter((c) => daysSinceLastVisit(c.lastVisit) > 30).length,
    new: customers.filter((c) => daysSinceLastVisit(c.memberSince) <= 30).length,
    wallet: customers.filter((c) => c.walletBalance > 0).length,
  }

  const filters: { key: SegmentFilter; label: string; icon: React.ElementType; active: string }[] = [
    { key: "all", label: "Tümü", icon: Users, active: "bg-violet-600 text-white" },
    { key: "vip", label: "VIP", icon: Crown, active: "bg-amber-500 text-white" },
    { key: "frequent", label: "Sık Gelen", icon: TrendingUp, active: "bg-emerald-500 text-white" },
    { key: "inactive", label: "30+ Gün Yok", icon: Clock, active: "bg-red-500 text-white" },
    { key: "new", label: "Yeni Üye", icon: UserPlus, active: "bg-sky-500 text-white" },
    { key: "wallet", label: "Cüzdan", icon: Wallet, active: "bg-blue-500 text-white" },
  ]

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filters.map(({ key, label, icon: Icon, active }) => {
        const isActive = activeFilter === key
        const count = counts[key]
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
              isActive
                ? `${active} shadow-sm`
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            <span className={cn(
              "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
              isActive ? "bg-white/25 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            )}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
