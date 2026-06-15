"use client"

import { TopBar } from "@/components/tv/top-bar"
import { ChildCard } from "@/components/tv/child-card"
import { AnnouncementPanel } from "@/components/tv/announcement-panel"
import { TickerBar } from "@/components/tv/ticker-bar"
import { useSessionStore } from "@/lib/stores/session-store"
import type { TvSession } from "@/lib/tv-data"
import { getStatus } from "@/types/aktif-oyun"

// Map status to the TV card's status string
function tvStatus(remainingSeconds: number): "ample" | "caution" | "critical" | "expired" {
  if (remainingSeconds <= 0)      return "expired"
  if (remainingSeconds <= 10 * 60) return "critical"
  if (remainingSeconds <= 30 * 60) return "caution"
  return "ample"
}

export default function TvPage() {
  const { sessions } = useSessionStore()

  // Convert ActiveSession → TvSession shape the existing ChildCard expects
  const tvSessions: TvSession[] = sessions.map((s) => ({
    id: s.id,
    childName: s.childName,
    remainingSeconds: s.remainingSeconds,
    totalSeconds: s.totalMinutes * 60,
  }))

  // Sort: critical → caution → ample → expired
  const sorted = [...tvSessions].sort((a, b) => {
    const order = { critical: 0, caution: 1, ample: 2, expired: 3 }
    return order[tvStatus(a.remainingSeconds)] - order[tvStatus(b.remainingSeconds)]
  })

  const activeCount = sessions.filter((s) => getStatus(s) !== "expired").length
  const totalCount  = sessions.length

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden text-white"
      style={{
        background: `
          radial-gradient(ellipse at 15% 50%, rgba(124,58,237,0.07) 0%, transparent 55%),
          radial-gradient(ellipse at 85% 15%, rgba(14,165,233,0.05) 0%, transparent 50%),
          radial-gradient(ellipse at 60% 85%, rgba(16,185,129,0.04) 0%, transparent 45%),
          #060610
        `,
      }}
    >
      <TopBar childCount={totalCount} activeCount={activeCount} />

      <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
        {/* Child cards grid */}
        <div className="flex-1 overflow-hidden">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/30 text-lg font-medium">Oyun alanı boş</p>
            </div>
          ) : (
            <div className="h-full grid grid-cols-3 xl:grid-cols-4 gap-3 content-start overflow-y-auto">
              {sorted.map((session) => (
                <ChildCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-72 xl:w-80 flex-shrink-0 flex flex-col min-h-0">
          <AnnouncementPanel />
        </div>
      </div>

      <TickerBar />
    </div>
  )
}
