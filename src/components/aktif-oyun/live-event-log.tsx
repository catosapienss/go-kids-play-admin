"use client"

import { LogIn, LogOut, Timer, Pause, Play, AlertCircle, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LiveEvent, EventType } from "@/types/aktif-oyun"
import { EVENT_LABELS, EVENT_COLORS } from "@/lib/aktif-oyun-data"

interface LiveEventLogProps {
  events: LiveEvent[]
}

const EVENT_ICONS: Record<EventType, React.ElementType> = {
  entry: LogIn,
  exit: LogOut,
  extend: Timer,
  pause: Pause,
  resume: Play,
  expire: AlertCircle,
}

function timeAgo(date: Date): string {
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSeconds < 60) return `${diffSeconds}sn`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}dk`
  const diffHours = Math.floor(diffMinutes / 60)
  return `${diffHours}sa`
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

export function LiveEventLog({ events }: LiveEventLogProps) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">Canlı İşlemler</p>
            <p className="text-[10px] text-slate-400">{events.length} kayıt</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-100 dark:bg-red-500/10 rounded-lg">
          <span className="relative flex w-1.5 h-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          <span className="text-[10px] font-bold text-red-600 dark:text-red-400">CANLI</span>
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <Activity className="w-6 h-6 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs text-slate-400">Henüz işlem yok</p>
          </div>
        )}
        {events.map((event, idx) => {
          const Icon = EVENT_ICONS[event.type]
          const dotColor = EVENT_COLORS[event.type]
          const isNew = idx === 0

          return (
            <div
              key={event.id}
              className={cn(
                "px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                isNew && "bg-violet-50/50 dark:bg-violet-500/5 animate-in slide-in-from-top-2 duration-300"
              )}
            >
              <div className="flex items-start gap-2.5">
                {/* Icon */}
                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-white flex-shrink-0 mt-0.5", dotColor)}>
                  <Icon className="w-3 h-3" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {event.childName}
                    </p>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className={cn(
                      "inline-block px-1.5 py-px rounded text-[10px] font-semibold text-white mr-1",
                      dotColor
                    )}>
                      {EVENT_LABELS[event.type]}
                    </span>
                    {event.detail && <span>{event.detail}</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400 truncate">{event.parentName}</span>
                    <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-[10px] text-slate-400">{event.staffName}</span>
                    <span className="text-[10px] text-slate-300 dark:text-slate-600 ml-auto">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
        <p className="text-[10px] text-slate-400 text-center">Tüm işlemler kaydediliyor</p>
      </div>
    </div>
  )
}
