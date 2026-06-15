"use client"

import { useEffect, useState } from "react"
import { ArrowUpRight, ArrowDownLeft, XCircle, LogIn, Wallet, Calendar, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActivityItem } from "@/types/personel"

const ACTIVITY_META = {
  payment: { icon: ArrowUpRight, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10", label: "Ödeme" },
  refund: { icon: ArrowDownLeft, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-500/10", label: "İade" },
  cancel: { icon: XCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/10", label: "İptal" },
  login: { icon: LogIn, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-500/10", label: "Giriş" },
  logout: { icon: LogIn, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800", label: "Çıkış" },
  wallet_load: { icon: Wallet, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-500/10", label: "Cüzdan" },
  org_action: { icon: Calendar, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/10", label: "Organizasyon" },
  checkin: { icon: ArrowUpRight, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-100 dark:bg-teal-500/10", label: "Giriş" },
  checkout: { icon: ArrowDownLeft, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800", label: "Çıkış" },
  extend: { icon: Clock, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-500/10", label: "Uzatma" },
}

const STAFF_COLORS: Record<string, string> = {
  "s_001": "bg-slate-800",
  "s_002": "bg-violet-600",
  "s_003": "bg-sky-600",
  "s_004": "bg-emerald-600",
}

interface ActivityFeedProps {
  activities: ActivityItem[]
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const [highlighted, setHighlighted] = useState<string | null>(activities[0]?.id ?? null)

  useEffect(() => {
    const id = setTimeout(() => setHighlighted(null), 3000)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-3 h-3">
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
            <span className="absolute w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-60" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Canlı Aktivite</p>
        </div>
        <span className="text-xs text-slate-400">{activities.length} işlem</span>
      </div>

      {/* Feed */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[520px] overflow-y-auto">
        {activities.map((act) => {
          const meta = ACTIVITY_META[act.type] ?? ACTIVITY_META.payment
          const Icon = meta.icon
          const isNew = act.id === highlighted

          return (
            <div
              key={act.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3 transition-colors duration-1000",
                isNew ? "bg-violet-50 dark:bg-violet-500/5" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
              )}
            >
              {/* Activity icon */}
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", meta.bg)}>
                <Icon className={cn("w-3.5 h-3.5", meta.color)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {/* Staff badge */}
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded text-white", STAFF_COLORS[act.staffId] ?? "bg-slate-600")}>
                    {act.staffName}
                  </span>
                  <span className="text-[10px] text-slate-400">{meta.label}</span>
                  {isNew && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded">
                      YENİ
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{act.description}</p>
              </div>

              {/* Time */}
              <p className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">{act.datetime}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
