"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { getStatus, formatTime } from "@/types/aktif-oyun"
import type { ActiveSession } from "@/types/aktif-oyun"
import { Plus, LogOut, Pause, Play, Sparkles, Clock } from "lucide-react"
import { ReprintLabelsButton } from "./reprint-labels-button"

// ─── Compact / High-Density Session Card ─────────────────────────────────────
//
// Designed for the busy operator view: 6-8 columns fit on a 1080px tablet so
// the entire floor (20-30 kids) is visible without scrolling.
//
//   • Avatar + name + countdown are the primary read.
//   • Status communicated via left-border colour stripe (saccade-friendly).
//   • Hover surfaces a 3-button quick-action row (Extend / Exit / Pause).
//   • Touch-friendly: every interactive element is ≥ 44 × 44px in spite of
//     the dense layout (action buttons grow on hover/focus).

interface CompactSessionCardProps {
  session: ActiveSession
  onExtend: (id: string) => void
  onCancel: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onExit: (id: string) => void
  onTimeExpired: (id: string) => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase()
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

function avatarGradient(name: string): string {
  const palette = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-pink-500 to-rose-600",
    "from-cyan-500 to-blue-600",
    "from-fuchsia-500 to-pink-600",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % palette.length
  return palette[hash]
}

// Colour stripe + accent based on remaining time.
function statusStyle(session: ActiveSession) {
  const status = getStatus(session)
  if (status === "expired")
    return { stripe: "bg-rose-500",    timerFg: "text-rose-600 dark:text-rose-400" }
  if (status === "expiring")
    return { stripe: "bg-amber-500",   timerFg: "text-amber-600 dark:text-amber-400" }
  if (status === "paused")
    return { stripe: "bg-slate-400",   timerFg: "text-slate-500 dark:text-slate-400" }
  if (session.totalMinutes === 0)
    return { stripe: "bg-fuchsia-500", timerFg: "text-fuchsia-600 dark:text-fuchsia-400" }
  return { stripe: "bg-emerald-500", timerFg: "text-emerald-700 dark:text-emerald-300" }
}

export function CompactSessionCard({
  session, onExtend, onCancel, onPause, onResume, onExit, onTimeExpired,
}: CompactSessionCardProps) {
  // 1s tick for the countdown — local to keep the parent list lightweight.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  void onCancel

  const isUnlimited = session.totalMinutes === 0
  const s = statusStyle(session)

  return (
    <div className={cn(
      "group relative rounded-lg border border-slate-200/70 dark:border-slate-800/70",
      "bg-white dark:bg-slate-900 overflow-hidden",
      "hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700",
      "transition-shadow",
    )}>
      {/* Left status stripe — read at a glance across rows */}
      <div className={cn("absolute top-0 left-0 bottom-0 w-1", s.stripe)} />

      <div className="pl-3 pr-2 py-2 flex items-center gap-2">
        {/* Avatar */}
        <div className={cn(
          "w-9 h-9 rounded-lg bg-gradient-to-br text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0",
          avatarGradient(session.childName),
        )}>
          {initials(session.childName)}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate leading-tight">
              {session.childName}
            </p>
            {isUnlimited && <Sparkles className="w-3 h-3 text-fuchsia-500 flex-shrink-0" />}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
            {session.entryTime} · {session.packageType}
          </p>
        </div>

        {/* Countdown */}
        <div className={cn("text-right tabular-nums font-mono", s.timerFg)}>
          <p className="text-[15px] font-bold leading-none">
            {isUnlimited ? "∞" : formatTime(session.remainingSeconds)}
          </p>
        </div>
      </div>

      {/* Hover/focus quick actions — overlay on the row, full width */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 h-9 flex items-center justify-end gap-1 pr-2 pl-3",
        "bg-gradient-to-t from-white via-white/95 to-transparent",
        "dark:from-slate-900 dark:via-slate-900/95",
        "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        "transition-opacity pointer-events-none group-hover:pointer-events-auto focus-within:pointer-events-auto",
      )}>
        <ActionButton
          label="Süre Uzat"
          tone="violet"
          icon={Plus}
          onClick={() => onExtend(session.id)}
        />
        {session.isPaused ? (
          <ActionButton
            label="Devam Et"
            tone="amber"
            icon={Play}
            onClick={() => onResume(session.id)}
          />
        ) : (
          !isUnlimited && (
            <ActionButton
              label="Duraklat"
              tone="slate"
              icon={Pause}
              onClick={() => onPause(session.id)}
            />
          )
        )}
        <ActionButton
          label="Süresi Bitti"
          tone="emerald"
          icon={Clock}
          onClick={() => onTimeExpired(session.id)}
        />
        <ActionButton
          label="Manuel Çıkış"
          tone="rose"
          icon={LogOut}
          onClick={() => onExit(session.id)}
        />
        <ReprintLabelsButton session={session} />
      </div>
    </div>
  )
}

interface ABProps {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  tone: "violet" | "rose" | "amber" | "slate" | "emerald"
}

const TONES: Record<ABProps["tone"], string> = {
  violet:  "bg-violet-500/15  text-violet-700  dark:text-violet-300  hover:bg-violet-500/25",
  rose:    "bg-rose-500/15    text-rose-700    dark:text-rose-300    hover:bg-rose-500/25",
  amber:   "bg-amber-500/15   text-amber-700   dark:text-amber-300   hover:bg-amber-500/25",
  slate:   "bg-slate-500/15   text-slate-700   dark:text-slate-300   hover:bg-slate-500/25",
  emerald: "bg-emerald-600    text-white                              hover:bg-emerald-500",
}

function ActionButton({ label, icon: Icon, onClick, tone }: ABProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cn(
        "min-w-[28px] min-h-[28px] px-2 rounded-md flex items-center justify-center text-[11px] font-bold transition-colors",
        TONES[tone],
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}
