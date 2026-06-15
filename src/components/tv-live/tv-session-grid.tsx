"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { type ActiveSession, getStatus } from "@/types/aktif-oyun"
import { TvSessionTile, type TileSize } from "./tv-session-tile"

// ─── TV Session Grid ──────────────────────────────────────────────────────────
//
// Auto-sizing layout — picks a tile density based on how many children are
// currently on the floor. The intent is to keep each tile as large as possible
// while still fitting everyone above the fold.
//
//   ≤  6 sessions → "large"   (3 columns)
//   ≤ 16 sessions → "regular" (4 columns)
//   ≤ 30 sessions → "compact" (5-6 columns)
//   >  30          → "compact" (auto-flowing 6+ columns)
//
// `mode` prop allows manual override (compact / large / minimal / auto).

export type DisplayMode = "auto" | "compact" | "regular" | "large" | "minimal"

interface Props {
  sessions: ActiveSession[]
  mode?: DisplayMode
}

interface Layout {
  size: TileSize
  cols: string
  gap:  string
}

function deriveLayout(count: number, mode: DisplayMode): Layout {
  // Explicit overrides
  if (mode === "compact") return { size: "compact", cols: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6", gap: "gap-3" }
  if (mode === "regular") return { size: "regular", cols: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4", gap: "gap-4" }
  if (mode === "large")   return { size: "large",   cols: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3", gap: "gap-5" }
  if (mode === "minimal") return { size: "regular", cols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", gap: "gap-4" }

  // Auto — count-based
  if (count <= 6)  return { size: "large",   cols: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3", gap: "gap-5" }
  if (count <= 16) return { size: "regular", cols: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4", gap: "gap-4" }
  if (count <= 30) return { size: "compact", cols: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6", gap: "gap-3" }
  return { size: "compact", cols: "grid-cols-4 lg:grid-cols-6 xl:grid-cols-8", gap: "gap-2.5" }
}

export function TvSessionGrid({ sessions, mode = "auto" }: Props) {
  // Sort by urgency: critical → caution → unlimited → normal → paused → expired
  // Within a bucket, by least time remaining (so the most urgent is top-left).
  const sorted = useMemo(() => {
    const bucket = (s: ActiveSession) => {
      const st = getStatus(s)
      if (st === "expired") return 5
      if (st === "paused")  return 4
      if (s.totalMinutes === 0) return 2
      if (st === "expiring") return s.remainingSeconds <= 5 * 60 ? 0 : 1
      return 3
    }
    return [...sessions].sort((a, b) => {
      const ba = bucket(a), bb = bucket(b)
      if (ba !== bb) return ba - bb
      return a.remainingSeconds - b.remainingSeconds
    })
  }, [sessions])

  const layout = useMemo(() => deriveLayout(sorted.length, mode), [sorted.length, mode])

  if (sorted.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-3xl font-bold text-white/40">Şu an içeride çocuk yok</p>
          <p className="text-sm uppercase tracking-widest text-white/30 mt-3">
            Yeni giriş yapıldığında burada görünecek
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "px-8 lg:px-12 pb-8 lg:pb-10 pt-2",
      "grid", layout.cols, layout.gap,
    )}>
      {sorted.map((s) => (
        <TvSessionTile key={s.id} session={s} size={layout.size} />
      ))}
    </div>
  )
}
