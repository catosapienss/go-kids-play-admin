"use client"

import { useEffect, useState } from "react"
import { useSessionStore } from "@/lib/stores/session-store"
import { formatTime, getStatus, type ActiveSession } from "@/types/aktif-oyun"
import { cn } from "@/lib/utils"
import { Radio, Sparkles, AlertTriangle, ArrowRight } from "lucide-react"
import Link from "next/link"

function StatusDot({ status }: { status: ReturnType<typeof getStatus> }) {
  const map = {
    active:   "bg-emerald-500",
    expiring: "bg-amber-500 animate-pulse",
    expired:  "bg-rose-500",
    paused:   "bg-slate-400",
  }
  return <span className={cn("w-1.5 h-1.5 rounded-full", map[status])} />
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? "?"
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

function SessionRow({ session, tick }: { session: ActiveSession; tick: number }) {
  // tick is used to force re-render so countdowns refresh — passing it to JSX as a dep proxy
  void tick
  const status = getStatus(session)
  const isUnlimited = session.totalMinutes === 0
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg transition-colors">
      <div className={cn(
        "w-8 h-8 rounded-lg bg-gradient-to-br text-white text-xs font-bold flex items-center justify-center flex-shrink-0",
        avatarGradient(session.childName),
      )}>
        {initials(session.childName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <StatusDot status={status} />
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{session.childName}</p>
          {isUnlimited && <Sparkles className="w-3 h-3 text-fuchsia-500 flex-shrink-0" />}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {session.entryTime} · {session.parentName}
        </p>
      </div>
      <div className="text-right">
        <p className={cn(
          "text-sm font-bold tabular-nums",
          status === "expiring" ? "text-amber-600 dark:text-amber-400"
          : status === "expired" ? "text-rose-600 dark:text-rose-400"
          : isUnlimited ? "text-fuchsia-600 dark:text-fuchsia-400"
          : "text-slate-700 dark:text-slate-200",
        )}>
          {isUnlimited ? "∞" : formatTime(session.remainingSeconds)}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">{session.packageType}</p>
      </div>
    </div>
  )
}

export function LiveOperationsPanel() {
  const { sessions } = useSessionStore()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const active = sessions.filter((s) => getStatus(s) !== "expired")
  const expiring = active.filter((s) => getStatus(s) === "expiring").length
  const unlimited = active.filter((s) => s.totalMinutes === 0).length
  const sorted = [...active].sort((a, b) => {
    // Expiring first (lowest seconds), unlimited last
    const aU = a.totalMinutes === 0, bU = b.totalMinutes === 0
    if (aU && !bU) return 1
    if (!aU && bU) return -1
    return a.remainingSeconds - b.remainingSeconds
  })

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-6 h-6">
            <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
            <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Canlı Operasyon</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {active.length} aktif · {expiring} bitiyor · {unlimited} sınırsız
            </p>
          </div>
        </div>
        <Link
          href="/aktif-oyun"
          className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
        >
          Hepsi <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0 max-h-[420px]">
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-500">
            Şu an içeride çocuk yok.
          </div>
        ) : (
          sorted.slice(0, 12).map((s) => <SessionRow key={s.id} session={s} tick={tick} />)
        )}
      </div>

      {expiring > 0 && (
        <div className="px-5 py-3 border-t border-amber-200/60 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-500/5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            {expiring} çocuğun süresi bitmek üzere — uzatma veya çıkış için kontrol et.
          </p>
        </div>
      )}
    </div>
  )
}
