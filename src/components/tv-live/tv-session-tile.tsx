"use client"

import { memo, useMemo } from "react"
import { Sparkles, Cake } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTime, type ActiveSession } from "@/types/aktif-oyun"

// ─── TV Session Tile ──────────────────────────────────────────────────────────
//
// One card per child currently on the floor. Optimised for readability at
// 3–6 metres — large typography, high-contrast tones, minimal decoration.
//
// Status tones:
//   • normal   — soft emerald (plenty of time)
//   • caution  — amber (≤ 10 min)
//   • critical — rose (≤ 5 min)
//   • expired  — desaturated grey (time's up, awaiting checkout)
//   • unlimited — fuchsia accent + ∞ glyph (no countdown)
//   • paused   — slate (frozen state)
//
// Memoised with custom equality so a tile only re-renders when *its* session
// changes — keeps the screen smooth even with 30+ children on a 24h display.

export type TileStatus = "normal" | "caution" | "critical" | "expired" | "unlimited" | "paused"

export type TileSize = "compact" | "regular" | "large"

interface Props {
  session: ActiveSession
  size?: TileSize
}

function computeStatus(s: ActiveSession): TileStatus {
  if (s.isPaused)                  return "paused"
  if (s.totalMinutes === 0)        return "unlimited"
  if (s.remainingSeconds <= 0)     return "expired"
  if (s.remainingSeconds <= 5 * 60) return "critical"
  if (s.remainingSeconds <= 10 * 60) return "caution"
  return "normal"
}

const TONE: Record<TileStatus, {
  bg:       string
  border:   string
  timeFg:   string
  glow:     string
  badge:    string
  pulse?:   boolean
}> = {
  normal: {
    bg:     "bg-gradient-to-br from-emerald-500/10 via-emerald-500/[0.05] to-transparent",
    border: "border-emerald-500/30",
    timeFg: "text-emerald-300",
    glow:   "shadow-[0_0_40px_-12px_rgb(16,185,129,0.4)]",
    badge:  "bg-emerald-500/15 text-emerald-300",
  },
  caution: {
    bg:     "bg-gradient-to-br from-amber-500/15 via-amber-500/[0.06] to-transparent",
    border: "border-amber-500/40",
    timeFg: "text-amber-300",
    glow:   "shadow-[0_0_45px_-10px_rgb(245,158,11,0.5)]",
    badge:  "bg-amber-500/20 text-amber-300",
  },
  critical: {
    bg:     "bg-gradient-to-br from-rose-500/20 via-rose-500/[0.08] to-transparent",
    border: "border-rose-500/60",
    timeFg: "text-rose-300",
    glow:   "shadow-[0_0_50px_-8px_rgb(244,63,94,0.6)]",
    badge:  "bg-rose-500/25 text-rose-200",
    pulse:  true,
  },
  expired: {
    bg:     "bg-gradient-to-br from-slate-700/40 to-transparent",
    border: "border-slate-600/50",
    timeFg: "text-slate-300",
    glow:   "",
    badge:  "bg-slate-700/40 text-slate-300",
  },
  unlimited: {
    bg:     "bg-gradient-to-br from-fuchsia-500/15 via-purple-500/10 to-transparent",
    border: "border-fuchsia-500/40",
    timeFg: "text-fuchsia-300",
    glow:   "shadow-[0_0_50px_-10px_rgb(217,70,239,0.5)]",
    badge:  "bg-fuchsia-500/15 text-fuchsia-300",
  },
  paused: {
    bg:     "bg-gradient-to-br from-slate-600/20 to-transparent",
    border: "border-slate-500/40",
    timeFg: "text-slate-300",
    glow:   "",
    badge:  "bg-slate-600/30 text-slate-300",
  },
}

const SIZE_CFG: Record<TileSize, {
  card:  string
  name:  string
  time:  string
  pkg:   string
}> = {
  compact: {
    card: "rounded-2xl p-3",
    name: "text-base font-bold",
    time: "text-3xl font-black tabular-nums",
    pkg:  "text-[10px]",
  },
  regular: {
    card: "rounded-3xl p-5",
    name: "text-xl font-bold",
    time: "text-5xl font-black tabular-nums",
    pkg:  "text-xs",
  },
  large: {
    card: "rounded-[2rem] p-7",
    name: "text-3xl font-bold",
    time: "text-7xl font-black tabular-nums",
    pkg:  "text-sm",
  },
}

const STATUS_LABEL: Record<TileStatus, string> = {
  normal:    "Aktif",
  caution:   "Az kaldı",
  critical:  "Bitiyor",
  expired:   "Süre doldu",
  unlimited: "Sınırsız",
  paused:    "Duraklatıldı",
}

// ─── Component (memoised by session id + remainingSeconds + paused/unlim) ────

function avatarGradient(name: string): string {
  const palette = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-pink-500 to-rose-600",
    "from-cyan-500 to-blue-600",
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % palette.length
  return palette[h]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? "?"
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

export const TvSessionTile = memo(
  function TvSessionTile({ session, size = "regular" }: Props) {
    const status = useMemo(() => computeStatus(session), [
      session.isPaused, session.totalMinutes, session.remainingSeconds,
    ])
    const t = TONE[status]
    const cfg = SIZE_CFG[size]
    const isUnlimited = status === "unlimited"
    const timeText = isUnlimited
      ? "∞"
      : status === "expired"
      ? "00:00"
      : formatTime(session.remainingSeconds)

    return (
      <div
        className={cn(
          "relative overflow-hidden border-2 backdrop-blur-sm transition-all duration-500",
          t.bg, t.border, t.glow, cfg.card,
          "bg-slate-900/40", // backdrop tint on top of the gradient
        )}
      >
        {/* Subtle pulse ring for critical */}
        {t.pulse && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-[inherit] ring-2 ring-rose-500/40 animate-pulse pointer-events-none"
          />
        )}

        <div className="flex items-center gap-3 mb-3">
          {/* Avatar */}
          <div className={cn(
            "rounded-2xl bg-gradient-to-br text-white font-black flex items-center justify-center flex-shrink-0",
            avatarGradient(session.childName),
            size === "compact" ? "w-10 h-10 text-sm" :
            size === "regular" ? "w-14 h-14 text-base" :
            "w-20 h-20 text-2xl",
          )}>
            {initials(session.childName)}
          </div>

          <div className="flex-1 min-w-0">
            <p className={cn(cfg.name, "text-white leading-tight truncate")}>
              {session.childName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn(
                "uppercase tracking-wider font-bold rounded-full px-2 py-0.5",
                cfg.pkg, t.badge,
              )}>
                {STATUS_LABEL[status]}
              </span>
              {isUnlimited && <Sparkles className="w-3 h-3 text-fuchsia-300" />}
            </div>
          </div>
        </div>

        {/* Time display — the focal point */}
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn(cfg.time, t.timeFg, "leading-none tracking-tight")}>
            {timeText}
          </span>
          <span className={cn(
            "uppercase tracking-wider text-white/40 font-semibold",
            size === "compact" ? "text-[9px]" : size === "regular" ? "text-[11px]" : "text-sm",
          )}>
            {isUnlimited ? "Serbest" : `${session.totalMinutes}dk`}
          </span>
        </div>

        {/* Progress bar (only for time-bound sessions) */}
        {!isUnlimited && session.totalMinutes > 0 && (
          <div className={cn(
            "mt-3 rounded-full bg-white/10 overflow-hidden",
            size === "compact" ? "h-1" : "h-1.5",
          )}>
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-linear",
                status === "critical" ? "bg-rose-400" :
                status === "caution"  ? "bg-amber-400" :
                status === "expired"  ? "bg-slate-500" :
                "bg-emerald-400",
              )}
              style={{
                width: `${Math.max(0, Math.min(100,
                  (session.remainingSeconds / (session.totalMinutes * 60)) * 100,
                ))}%`,
              }}
            />
          </div>
        )}
      </div>
    )
  },
  // Custom equality — only re-render when *meaningful* state changes.
  (prev, next) =>
    prev.size === next.size
    && prev.session.id === next.session.id
    && prev.session.childName === next.session.childName
    && prev.session.isPaused === next.session.isPaused
    && prev.session.totalMinutes === next.session.totalMinutes
    && Math.abs(prev.session.remainingSeconds - next.session.remainingSeconds) < 1,
)
