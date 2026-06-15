"use client"

import { Timer, Crown, UserPlus, Pause, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FilterType, ActiveSession } from "@/types/aktif-oyun"
import { getStatus } from "@/types/aktif-oyun"

interface FilterBarProps {
  activeFilter: FilterType
  onChange: (filter: FilterType) => void
  sessions: ActiveSession[]
}

export function FilterBar({ activeFilter, onChange, sessions }: FilterBarProps) {
  const counts: Record<FilterType, number> = {
    all: sessions.length,
    expiring: sessions.filter((s) => getStatus(s) === "expiring").length,
    vip: sessions.filter((s) => s.isVip).length,
    new: sessions.filter((s) => Date.now() - s.entryTimestamp < 10 * 60 * 1000).length,
    paused: sessions.filter((s) => s.isPaused).length,
  }

  const filters: { key: FilterType; label: string; icon: React.ElementType; activeStyle: string }[] = [
    {
      key: "all",
      label: "Tümü",
      icon: LayoutGrid,
      activeStyle: "bg-violet-600 text-white shadow-sm shadow-violet-500/20",
    },
    {
      key: "expiring",
      label: "Bitiyor",
      icon: Timer,
      activeStyle: "bg-red-500 text-white shadow-sm shadow-red-500/20",
    },
    {
      key: "vip",
      label: "VIP",
      icon: Crown,
      activeStyle: "bg-amber-500 text-white shadow-sm shadow-amber-500/20",
    },
    {
      key: "new",
      label: "Yeni Giriş",
      icon: UserPlus,
      activeStyle: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20",
    },
    {
      key: "paused",
      label: "Duraklat",
      icon: Pause,
      activeStyle: "bg-amber-500 text-white shadow-sm shadow-amber-500/20",
    },
  ]

  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
      {filters.map(({ key, label, icon: Icon, activeStyle }) => {
        const isActive = activeFilter === key
        const count = counts[key]
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0",
              isActive
                ? activeStyle
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            {count > 0 && (
              <span
                className={cn(
                  "ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                  isActive
                    ? "bg-white/30 text-white"
                    : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
