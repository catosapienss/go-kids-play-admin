"use client"

import { useEffect, useState } from "react"
import { Baby, Clock, Timer, TrendingUp, Search, Wifi, X } from "lucide-react"
import type { ActiveSession } from "@/types/aktif-oyun"
import { getStatus, formatTime } from "@/types/aktif-oyun"
import { cn } from "@/lib/utils"

interface TopStatsBarProps {
  sessions: ActiveSession[]
  searchQuery: string
  onSearchChange: (q: string) => void
}

function LiveClock() {
  const [time, setTime] = useState("")

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return <span className="tabular-nums font-mono">{time}</span>
}

export function TopStatsBar({ sessions, searchQuery, onSearchChange }: TopStatsBarProps) {
  const active = sessions.filter((s) => !s.isPaused && s.remainingSeconds > 0)
  const expiring = sessions.filter((s) => getStatus(s) === "expiring")
  const paused = sessions.filter((s) => s.isPaused)

  const avgRemaining =
    active.length > 0
      ? Math.floor(active.reduce((sum, s) => sum + s.remainingSeconds, 0) / active.length / 60)
      : 0

  const totalChildren = sessions.length
  const density =
    totalChildren >= 20
      ? { label: "Dolu", color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/10", dot: "bg-red-500" }
      : totalChildren >= 12
      ? { label: "Yoğun", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/10", dot: "bg-amber-500" }
      : totalChildren >= 6
      ? { label: "Normal", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10", dot: "bg-emerald-500" }
      : { label: "Sakin", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-500/10", dot: "bg-sky-500" }

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">

        {/* Live indicator + clock */}
        <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-500/10 rounded-lg">
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-bold text-red-600 dark:text-red-400 tracking-wide">CANLI</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-white text-sm font-semibold">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <LiveClock />
          </div>
        </div>

        {/* Stats chips */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Total children */}
          <StatChip
            icon={Baby}
            value={totalChildren}
            label="Çocuk"
            color="text-violet-600 dark:text-violet-400"
            bg="bg-violet-100 dark:bg-violet-500/10"
          />

          {/* Expiring soon */}
          {expiring.length > 0 && (
            <StatChip
              icon={Timer}
              value={expiring.length}
              label="Bitiyor"
              color="text-red-600 dark:text-red-400"
              bg="bg-red-100 dark:bg-red-500/10"
              pulse
            />
          )}

          {/* Paused */}
          {paused.length > 0 && (
            <StatChip
              icon={Timer}
              value={paused.length}
              label="Duraklat"
              color="text-amber-600 dark:text-amber-400"
              bg="bg-amber-100 dark:bg-amber-500/10"
            />
          )}

          {/* Avg remaining */}
          <StatChip
            icon={TrendingUp}
            value={formatTime(avgRemaining * 60)}
            label="Ort. Kalan"
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-100 dark:bg-emerald-500/10"
          />

          {/* Density */}
          <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold", density.bg, density.color)}>
            <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", density.dot)} />
            {density.label}
          </div>

          {/* Connection */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Wifi className="w-3 h-3" />
            <span>Bağlı</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-48 xl:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Çocuk veya veli ara..."
            className="w-full pl-8 pr-8 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all border border-transparent focus:border-violet-300 dark:focus:border-violet-600"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>
      </div>

      {/* Capacity bar */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[10px] text-slate-400 font-medium w-12 flex-shrink-0">Kapasite</span>
        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              totalChildren >= 20
                ? "bg-red-500"
                : totalChildren >= 12
                ? "bg-amber-500"
                : "bg-emerald-500"
            )}
            style={{ width: `${Math.min(100, (totalChildren / 25) * 100)}%` }}
          />
        </div>
        <span className="text-[10px] text-slate-400 w-8 text-right">{totalChildren}/25</span>
      </div>
    </div>
  )
}

function StatChip({
  icon: Icon,
  value,
  label,
  color,
  bg,
  pulse,
}: {
  icon: React.ElementType
  value: string | number
  label: string
  color: string
  bg: string
  pulse?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold", bg, color)}>
      <Icon className={cn("w-3.5 h-3.5", pulse && "animate-pulse")} />
      <span className="font-bold">{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  )
}
