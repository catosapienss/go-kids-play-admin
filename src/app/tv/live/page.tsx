"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSessionStore } from "@/lib/stores/session-store"
import { useSettingsSection } from "@/lib/settings/settings-store"
import { getStatus } from "@/types/aktif-oyun"
import { TvLiveHeader } from "@/components/tv-live/tv-live-header"
import { TvSessionGrid, type DisplayMode } from "@/components/tv-live/tv-session-grid"
import { TvEventBanner } from "@/components/tv-live/tv-event-banner"
import { BRAND } from "@/lib/brand"

// ─── /tv/live — Premium floor display ─────────────────────────────────────────
//
// Built for 24/7 kiosk operation. Optimisations:
//
//   • Single useEffect drives 1s ticking — memoised tiles only re-render when
//     their *own* remaining seconds change (custom equality fn in TvSessionTile).
//   • The session store is already realtime + reconnect-aware (RealtimeSupervisor).
//   • Cursor auto-hides after 4s of inactivity for that cinema-screen look.
//   • Mode override via URL: /tv/live?mode=large|compact|regular|minimal|auto
//
// Note: this page deliberately bypasses the admin MainLayout (sidebar/header)
// because TV/`/tv/live/layout.tsx` already opts it out.

function isValidMode(s: string | null): s is DisplayMode {
  return s === "auto" || s === "compact" || s === "regular" || s === "large" || s === "minimal"
}

export default function TvLivePage() {
  const search = useSearchParams()
  const modeParam = search.get("mode")
  // URL parameter wins (lets a kiosk operator force a layout for a specific
  // screen); otherwise fall back to the operator preference from /ayarlar.
  const tvSettings = useSettingsSection("tv")
  const mode: DisplayMode = isValidMode(modeParam) ? modeParam : tvSettings.displayMode

  const { sessions } = useSessionStore()
  const [cursorVisible, setCursorVisible] = useState(true)

  // Filter out completed/expired-checked-out sessions so the wall stays clean.
  const live = sessions.filter((s) => getStatus(s) !== "expired" || s.remainingSeconds > -120)

  const counters = {
    active:    live.length,
    expiring:  live.filter((s) => getStatus(s) === "expiring").length,
    unlimited: live.filter((s) => s.totalMinutes === 0).length,
  }

  // ── Cursor idle-hide (cinema-mode) ────────────────────────────────────────
  useEffect(() => {
    // Honour operator preference — cinema mode can be disabled from /ayarlar.
    if (!tvSettings.cinemaCursorHide) {
      setCursorVisible(true)
      return
    }
    let timeoutId: ReturnType<typeof setTimeout>
    const reset = () => {
      setCursorVisible(true)
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => setCursorVisible(false), 4000)
    }
    reset()
    window.addEventListener("mousemove", reset)
    window.addEventListener("touchstart", reset)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("mousemove", reset)
      window.removeEventListener("touchstart", reset)
    }
  }, [tvSettings.cinemaCursorHide])

  // ── 1s tick to keep countdowns smooth ─────────────────────────────────────
  //
  // The session store doesn't tick by itself — it relies on consumers to drive
  // re-renders. One forceUpdate per second is cheap and keeps tile equality
  // checks honest (tile re-renders only when *its* remaining seconds change).
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => (n + 1) & 0xffff), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <main
      className="min-h-screen w-full flex flex-col text-white relative overflow-hidden"
      style={{
        background: "radial-gradient(circle at 20% 0%, rgba(124, 58, 237, 0.15), transparent 60%), radial-gradient(circle at 90% 100%, rgba(236, 72, 153, 0.10), transparent 55%), #0b0b15",
        cursor: cursorVisible ? "default" : "none",
      }}
    >
      {/* Brand accent strip — subtle 1px gradient along the very top */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[2px] opacity-50"
        style={{
          background: `linear-gradient(90deg, ${BRAND.mark.green}, ${BRAND.mark.pink}, ${BRAND.mark.yellow})`,
        }}
      />

      {/* Subtle dot-grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <TvLiveHeader
        activeCount={counters.active}
        expiringCount={counters.expiring}
        unlimitedCount={counters.unlimited}
      />

      <TvEventBanner />

      <TvSessionGrid sessions={live} mode={mode} />

      {/* Footer hint — kept minimal */}
      <footer className="mt-auto px-8 lg:px-12 py-3 border-t border-white/[0.05] flex items-center justify-between text-[10px] uppercase tracking-widest text-white/30">
        <span>Go Kids Play · Canlı Operasyon Ekranı</span>
        <span className="hidden md:inline">
          {mode === "auto" ? "Otomatik düzen" : `Düzen: ${mode}`} ·
          Mod değiştirmek için <code className="font-mono text-white/40 ml-1">?mode=large</code>
        </span>
      </footer>
    </main>
  )
}
