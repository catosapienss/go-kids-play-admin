"use client"

import { Crown, Pause, Play, LogOut, Plus, ChevronDown, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { getStatus, formatTime, elapsedMinutes } from "@/types/aktif-oyun"
import type { ActiveSession } from "@/types/aktif-oyun"
import { useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ReprintLabelsButton } from "./reprint-labels-button"

interface ActiveChildCardProps {
  session: ActiveSession
  onExtend: (id: string) => void
  onCancel: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onExit: (id: string) => void
}

const STATUS_CONFIG = {
  active: {
    border: "border-emerald-200 dark:border-emerald-500/25",
    timerColor: "text-emerald-600 dark:text-emerald-400",
    timerBg: "bg-emerald-50 dark:bg-emerald-500/10",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    label: "Aktif",
  },
  expiring: {
    border: "border-red-300 dark:border-red-500/40",
    timerColor: "text-red-600 dark:text-red-400",
    timerBg: "bg-red-50 dark:bg-red-500/10",
    bar: "bg-red-500",
    dot: "bg-red-500 animate-ping",
    badge: "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400",
    label: "Bitiyor",
  },
  paused: {
    border: "border-amber-200 dark:border-amber-500/25",
    timerColor: "text-amber-600 dark:text-amber-400",
    timerBg: "bg-amber-50 dark:bg-amber-500/10",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    badge: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400",
    label: "Duraklı",
  },
  expired: {
    border: "border-slate-200 dark:border-slate-700",
    timerColor: "text-slate-400 dark:text-slate-500",
    timerBg: "bg-slate-100 dark:bg-slate-800",
    bar: "bg-slate-300",
    dot: "bg-slate-400",
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
    label: "Bitti",
  },
}

const PKG_COLORS: Record<string, string> = {
  "30dk":    "bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400",
  "60dk":    "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "90dk":    "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "Serbest": "bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400",
}

const AVATAR_COLORS = [
  "from-violet-400 to-purple-500",
  "from-pink-400 to-rose-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-green-500",
  "from-orange-400 to-amber-500",
  "from-cyan-400 to-teal-500",
]

export function ActiveChildCard({ session, onExtend, onCancel, onPause, onResume, onExit }: ActiveChildCardProps) {
  const status = getStatus(session)
  const cfg = STATUS_CONFIG[status]
  const elapsed = elapsedMinutes(session.entryTimestamp)
  const progress = session.totalMinutes > 0
    ? Math.max(0, Math.min(100, ((session.totalMinutes * 60 - session.remainingSeconds) / (session.totalMinutes * 60)) * 100))
    : 100

  const avatarColor = AVATAR_COLORS[session.childName.charCodeAt(0) % AVATAR_COLORS.length]
  const [expanded, setExpanded] = useState(false)

  const isUnlimited = session.packageType === "Serbest"
  const canPause = isUnlimited
  const isExpired = status === "expired"
  const isExpiring = status === "expiring"

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "bg-white dark:bg-slate-900 rounded-2xl border-2 shadow-sm transition-all duration-200 overflow-hidden",
          cfg.border,
          isExpiring && "ring-2 ring-red-500/20 animate-pulse-slow",
          isExpired && "opacity-70",
        )}
      >
        {/* ── Top row: avatar + name + badges ────────────────────────────── */}
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shadow-sm",
              avatarColor,
            )}>
              {session.childName.charAt(0)}
            </div>
            {session.isVip && (
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center">
                <Crown className="w-2 h-2 text-white" />
              </div>
            )}
          </div>

          {/* Name + parent */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-tight">
              {session.childName}
            </p>
            <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
              {session.parentName}
            </p>
          </div>

          {/* Status + package */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold", cfg.badge)}>
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
              {cfg.label}
            </span>
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", PKG_COLORS[session.packageType])}>
              {session.packageType}
            </span>
          </div>
        </div>

        {/* ── Timer ───────────────────────────────────────────────────────── */}
        <div className={cn("mx-3 mb-2 rounded-xl px-3 py-2", cfg.timerBg)}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-slate-400">Kalan Süre</span>
            <span className={cn(
              "text-xl font-bold tabular-nums tracking-tight",
              cfg.timerColor,
              isExpiring && "animate-pulse",
            )}>
              {isExpired
                ? "00:00"
                : isUnlimited
                ? "∞"
                : formatTime(session.remainingSeconds)}
            </span>
          </div>
          {!isUnlimited && (
            <div className="mt-1.5 h-1 bg-white/60 dark:bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-1000", cfg.bar)}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* ── Action bar ─────────────────────────────────────────────────── */}
        <div className="px-3 pb-3 flex items-center gap-1">
          {/* Extend */}
          <button
            onClick={() => onExtend(session.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-all active:scale-95 shadow-sm shadow-violet-500/20"
          >
            <Plus className="w-3 h-3" />
            Uzat
          </button>

          {/* Pause / Resume — disabled for timed packages */}
          {session.isPaused ? (
            <button
              onClick={() => onResume(session.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 dark:bg-emerald-500/15 hover:bg-emerald-200 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold transition-all active:scale-95"
            >
              <Play className="w-3 h-3" fill="currentColor" />
              Devam
            </button>
          ) : canPause ? (
            <button
              onClick={() => onPause(session.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 dark:bg-amber-500/15 hover:bg-amber-200 dark:hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-semibold transition-all active:scale-95"
            >
              <Pause className="w-3 h-3" />
              Duraklat
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 rounded-lg text-xs font-semibold cursor-not-allowed select-none">
                  <Pause className="w-3 h-3" />
                  Duraklat
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[180px] text-center">
                Duraklatma sadece sınırsız paketlerde kullanılabilir.
              </TooltipContent>
            </Tooltip>
          )}

          {/* Exit */}
          <button
            onClick={() => onExit(session.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-500/15 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-xs font-semibold transition-all active:scale-95"
          >
            <LogOut className="w-3 h-3" />
            Çıkış
          </button>

          {/* Reprint labels */}
          <ReprintLabelsButton session={session} />

          {/* Detail toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto px-1.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", expanded && "rotate-180")} />
          </button>
        </div>

        {/* ── Expanded detail ─────────────────────────────────────────────── */}
        {expanded && (
          <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-3 space-y-3 animate-in slide-in-from-top-1 duration-150">
            <div className="grid grid-cols-2 gap-y-1.5 text-xs">
              <span className="text-slate-400">Veli Tel:</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{session.parentPhone}</span>
              <span className="text-slate-400">Paket:</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{session.packageType} · {session.totalMinutes || "∞"} dk</span>
              <span className="text-slate-400">Personel:</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{session.staffName}</span>
              <span className="text-slate-400">Giriş:</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{session.entryTime} · {elapsed} dk önce</span>
            </div>
            <button
              onClick={() => onCancel(session.id)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl text-xs font-semibold transition-all active:scale-95"
            >
              <XCircle className="w-3.5 h-3.5" />
              İptal & İade
            </button>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
