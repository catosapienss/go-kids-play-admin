import { cn } from "@/lib/utils"
import { getSessionStatus, formatCountdown } from "@/lib/tv-data"
import type { TvSession } from "@/lib/tv-data"

const STATUS_CONFIG = {
  ample: {
    border: "border-emerald-500/25",
    shadow: "0 0 48px rgba(52,211,153,0.12)",
    bar: "bg-emerald-500",
    text: "text-emerald-400",
    avatarBg: "bg-emerald-500/15 text-emerald-300",
    topBar: "bg-emerald-500",
    bg: "bg-emerald-500/[0.04]",
    label: "DEVAM EDİYOR",
    labelColor: "text-emerald-500/70",
    pulse: false,
  },
  caution: {
    border: "border-amber-400/35",
    shadow: "0 0 48px rgba(251,191,36,0.14)",
    bar: "bg-amber-400",
    text: "text-amber-400",
    avatarBg: "bg-amber-400/15 text-amber-300",
    topBar: "bg-amber-400",
    bg: "bg-amber-400/[0.04]",
    label: "SÜRE AZALIYOR",
    labelColor: "text-amber-400/80",
    pulse: false,
  },
  critical: {
    border: "border-red-500/45",
    shadow: "0 0 60px rgba(239,68,68,0.22)",
    bar: "bg-red-500",
    text: "text-red-400",
    avatarBg: "bg-red-500/20 text-red-300",
    topBar: "bg-red-500",
    bg: "bg-red-500/[0.06]",
    label: "SON DAKİKALAR",
    labelColor: "text-red-400",
    pulse: true,
  },
  expired: {
    border: "border-slate-700/40",
    shadow: "none",
    bar: "bg-slate-700",
    text: "text-slate-500",
    avatarBg: "bg-slate-800 text-slate-600",
    topBar: "bg-slate-700",
    bg: "bg-slate-800/30",
    label: "SÜRE DOLDU",
    labelColor: "text-slate-600",
    pulse: false,
  },
}

interface ChildCardProps {
  session: TvSession
}

export function ChildCard({ session }: ChildCardProps) {
  const status = getSessionStatus(session.remainingSeconds)
  const cfg = STATUS_CONFIG[status]
  const pct = session.totalSeconds > 0
    ? Math.max(0, Math.min(100, (session.remainingSeconds / session.totalSeconds) * 100))
    : 0

  const isExpired = status === "expired"

  return (
    <div
      className={cn(
        "relative rounded-3xl border overflow-hidden flex flex-col",
        cfg.border,
        cfg.bg,
        "backdrop-blur-sm transition-all duration-500",
        cfg.pulse && "animate-pulse-slow"
      )}
      style={{ boxShadow: cfg.shadow }}
    >
      {/* Top accent bar */}
      <div className={cn("h-1 w-full flex-shrink-0", cfg.topBar)} />

      <div className="flex-1 flex flex-col p-5 gap-3">
        {/* Header: avatar + name + status label */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0",
              cfg.avatarBg
            )}>
              {session.childName.charAt(0)}
            </div>
            {/* Name */}
            <p className={cn(
              "text-xl font-black tracking-tight leading-none",
              isExpired ? "text-slate-500" : "text-white"
            )}>
              {session.childName.toUpperCase()}
            </p>
          </div>

          {/* Status label */}
          <span className={cn("text-[10px] font-black tracking-widest uppercase flex-shrink-0 mt-1", cfg.labelColor)}>
            {cfg.label}
          </span>
        </div>

        {/* Countdown — the main hero element */}
        <div className="text-center py-2">
          {isExpired ? (
            <div>
              <p className="text-5xl font-black text-slate-600 tabular-nums leading-none">
                00:00
              </p>
              <p className="text-xs text-slate-600 mt-2 font-semibold tracking-widest uppercase">
                süre doldu
              </p>
            </div>
          ) : (
            <div>
              <p className={cn(
                "text-5xl font-black tabular-nums leading-none",
                cfg.text
              )}>
                {formatCountdown(session.remainingSeconds)}
              </p>
              <p className="text-[11px] text-white/30 mt-2 font-semibold tracking-widest uppercase">
                kalan süre
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 mt-auto">
          <div className="h-2.5 bg-white/8 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-1000", cfg.bar)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/25 font-mono">
            <span>0</span>
            <span>{Math.round(session.totalSeconds / 60)} dk</span>
          </div>
        </div>
      </div>
    </div>
  )
}
