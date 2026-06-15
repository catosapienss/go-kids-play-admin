"use client"

import { useEffect, useState } from "react"
import { WifiOff, RadioTower } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNetworkStatus } from "@/lib/reliability/network-status"

// ─── Connectivity banner ──────────────────────────────────────────────────────
//
// Slides down from the top of the screen when:
//   • browser is offline, OR
//   • Supabase realtime channel is down for > 5s
//
// Self-dismissing the moment connectivity comes back.

const REALTIME_GRACE_MS = 5_000  // tolerate brief blips before showing the strip

export function OfflineBanner() {
  const { online, realtimeConnected, realtimeDownSince } = useNetworkStatus()
  const [showRealtimeDown, setShowRealtimeDown] = useState(false)

  useEffect(() => {
    if (realtimeConnected) {
      setShowRealtimeDown(false)
      return
    }
    if (!realtimeDownSince) return
    const since = realtimeDownSince
    const elapsed = Date.now() - since
    if (elapsed >= REALTIME_GRACE_MS) {
      setShowRealtimeDown(true)
      return
    }
    const id = setTimeout(() => setShowRealtimeDown(true), REALTIME_GRACE_MS - elapsed)
    return () => clearTimeout(id)
  }, [realtimeConnected, realtimeDownSince])

  if (online && !showRealtimeDown) return null

  const isOffline = !online

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-0 left-0 right-0 z-[60]",
        "flex items-center justify-center gap-2 px-4 py-1.5",
        "text-xs font-semibold text-white",
        isOffline ? "bg-rose-600" : "bg-amber-600",
        "shadow-md animate-[slideDown_200ms_ease-out]",
      )}
    >
      {isOffline
        ? <WifiOff className="w-3.5 h-3.5" />
        : <RadioTower className="w-3.5 h-3.5 animate-pulse" />}
      <span>
        {isOffline
          ? "İnternet bağlantısı yok — değişiklikler bağlantı dönünce kaydedilecek."
          : "Canlı bağlantı kesildi — yeniden bağlanılıyor…"}
      </span>
      <style jsx>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
