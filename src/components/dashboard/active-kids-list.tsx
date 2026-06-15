"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSessionStore } from "@/lib/stores/session-store"
import { getStatus, formatTime } from "@/types/aktif-oyun"
import { Clock, Timer, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-pink-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-cyan-500",
]

const STATUS_BADGE: Record<string, string> = {
  active:   "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  expiring: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400",
  paused:   "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
  expired:  "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
}

const STATUS_LABEL: Record<string, string> = {
  active:   "Aktif",
  expiring: "Bitiyor",
  paused:   "Duraklatıldı",
  expired:  "Bitti",
}

export function ActiveKidsList() {
  const { sessions, isLoading } = useSessionStore()

  // Sort: expiring first, then paused, active, expired
  const sorted = [...sessions]
    .sort((a, b) => {
      const order = { expiring: 0, paused: 1, active: 2, expired: 3 }
      return order[getStatus(a)] - order[getStatus(b)]
    })
    .slice(0, 8) // Show max 8 in the dashboard widget

  return (
    <Card className="p-6 rounded-2xl border-0 shadow-sm bg-white dark:bg-slate-900 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Aktif Çocuklar</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Şu an oyun alanında</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <Badge className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0 font-medium">
            {sessions.filter((s) => getStatus(s) !== "expired").length} aktif
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 py-6">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">Oyun alanı boş</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1">
          {sorted.map((session) => {
            const status = getStatus(session)
            const avatarColor = AVATAR_COLORS[session.childName.charCodeAt(0) % AVATAR_COLORS.length]

            return (
              <div
                key={session.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0", avatarColor)}>
                  {session.childName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{session.childName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {session.childAge} yaş · {session.parentName}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", STATUS_BADGE[status])}>
                    {STATUS_LABEL[status]}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Timer className="w-3 h-3" />
                    <span className={cn(
                      "font-mono tabular-nums",
                      status === "expiring" && "text-red-500 font-bold",
                    )}>
                      {session.packageType === "Serbest" ? "∞" : formatTime(session.remainingSeconds)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
