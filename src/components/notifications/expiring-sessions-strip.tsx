"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSessionStore } from "@/lib/stores/session-store"
import { formatTime, getStatus } from "@/types/aktif-oyun"

// ─── Sticky bottom-right strip for sessions about to expire ───────────────────
//
// A discrete, dismissible operational glance that hovers over the page.
// It is intentionally separate from the notification toast layer — toasts
// fire once per threshold, this strip is the *live state* of the floor.

export function ExpiringSessionsStrip() {
  const { sessions } = useSessionStore()
  const [tick, setTick] = useState(0)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  void tick

  const expiring = sessions
    .filter((s) =>
      !dismissedIds.has(s.id)
      && !s.isPaused
      && s.totalMinutes !== 0
      && getStatus(s) === "expiring",
    )
    .sort((a, b) => a.remainingSeconds - b.remainingSeconds)
    .slice(0, 3)

  if (expiring.length === 0) return null

  function dismiss(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 max-w-[320px] w-full pointer-events-none">
      {expiring.map((s) => {
        const critical = s.remainingSeconds <= 5 * 60
        return (
          <div
            key={s.id}
            className={cn(
              "pointer-events-auto rounded-xl border shadow-lg backdrop-blur-sm",
              "px-3 py-2.5 flex items-center gap-3",
              "animate-[slideInUp_220ms_ease-out]",
              critical
                ? "border-rose-300/70 dark:border-rose-700/60 bg-rose-50/95 dark:bg-rose-950/70"
                : "border-amber-300/70 dark:border-amber-700/60 bg-amber-50/95 dark:bg-amber-950/70",
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              critical
                ? "bg-rose-500 text-white animate-pulse"
                : "bg-amber-500 text-white",
            )}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-xs font-bold truncate",
                critical ? "text-rose-900 dark:text-rose-100" : "text-amber-900 dark:text-amber-100",
              )}>
                {s.childName}
              </p>
              <p className={cn(
                "text-[11px] tabular-nums",
                critical ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300",
              )}>
                {formatTime(s.remainingSeconds)} kaldı · {s.packageType}
              </p>
            </div>
            <Link
              href="/aktif-oyun"
              className={cn(
                "text-[11px] font-bold px-2 py-1 rounded-md transition-colors",
                critical
                  ? "bg-rose-500 text-white hover:bg-rose-600"
                  : "bg-amber-500 text-white hover:bg-amber-600",
              )}
            >
              Uzat
            </Link>
            <button
              type="button"
              onClick={() => dismiss(s.id)}
              aria-label="Kapat"
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )
      })}
      <style jsx>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
