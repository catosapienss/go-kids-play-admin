"use client"

import { useState, useCallback } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { TopStatsBar } from "@/components/aktif-oyun/top-stats-bar"
import { FilterBar } from "@/components/aktif-oyun/filter-bar"
import { ActiveChildCard } from "@/components/aktif-oyun/active-child-card"
import { CompactSessionCard } from "@/components/aktif-oyun/compact-session-card"
import { DensityToggle, useDensity } from "@/components/aktif-oyun/density-toggle"
import { ExtendTimeModal } from "@/components/aktif-oyun/extend-time-modal"
import { CancelSessionModal } from "@/components/aktif-oyun/cancel-session-modal"
import { EndSessionModal } from "@/components/aktif-oyun/end-session-modal"
import { CompletionHistoryPanel } from "@/components/aktif-oyun/completion-history-panel"
import { LiveEventLog } from "@/components/aktif-oyun/live-event-log"
import type { EndReason } from "@/lib/services/session.service"
import { useAuth } from "@/contexts/auth-context"
import { hasModuleAccess } from "@/lib/permissions"
import { useSessionStore } from "@/lib/stores/session-store"
import { getStatus } from "@/types/aktif-oyun"
import type { ActiveSession, FilterType } from "@/types/aktif-oyun"
import { Baby, Loader2 } from "lucide-react"

export default function AktifOyunPage() {
  const { sessions, events, isLoading, pause, resume, exit } = useSessionStore()
  const { user } = useAuth()
  const [filter, setFilter] = useState<FilterType>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [extendTarget, setExtendTarget] = useState<ActiveSession | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ActiveSession | null>(null)
  const [endTarget,    setEndTarget]    = useState<ActiveSession | null>(null)
  const [historyOpen,  setHistoryOpen]  = useState(false)
  const [density, setDensity] = useDensity()

  const canSeeHistory = !!user && (user.role === "admin" || user.role === "super_admin" || user.role === "manager")

  // ── Handlers (thin wrappers — store does the work) ──────────────────────

  const handlePause  = useCallback((id: string) => pause(id), [pause])
  const handleResume = useCallback((id: string) => resume(id), [resume])
  // Open the end-with-reason modal instead of immediately ending. The modal
  // calls exit(id, reason, note) once the operator confirms.
  const handleExit   = useCallback((id: string) => {
    const target = sessions.find((s) => s.id === id)
    if (target) setEndTarget(target)
  }, [sessions])

  const handleConfirmEnd = useCallback(async (reason: EndReason, note: string | undefined) => {
    if (!endTarget) return
    await exit(endTarget.id, reason, note)
  }, [endTarget, exit])

  // ── Filtering & sorting ────────────────────────────────────────────────

  const filtered = sessions.filter((s) => {
    const matchesSearch =
      searchQuery === "" ||
      s.childName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.parentName.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    switch (filter) {
      case "expiring": return getStatus(s) === "expiring"
      case "vip":      return s.isVip
      case "new":      return Date.now() - s.entryTimestamp < 10 * 60 * 1000
      case "paused":   return s.isPaused
      default:         return true
    }
  })

  const sorted = [...filtered].sort((a, b) => {
    const order = { expiring: 0, paused: 1, active: 2, expired: 3 }
    return order[getStatus(a)] - order[getStatus(b)]
  })

  const extendSession = sessions.find((s) => s.id === extendTarget?.id) ?? null
  const cancelSession = sessions.find((s) => s.id === cancelTarget?.id) ?? null

  return (
    <MainLayout title="Aktif Oyun Alanı" subtitle="Canlı süre yönetimi · Realtime">
      <div className="flex flex-col -m-6 overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
        {/* Top stats */}
        <TopStatsBar
          sessions={sessions}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Filter bar + density toggle */}
        <div className="flex items-center gap-2 px-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex-1 -mx-4">
            <FilterBar
              activeFilter={filter}
              onChange={setFilter}
              sessions={sessions}
            />
          </div>
          <div className="hidden md:block py-2">
            <DensityToggle value={density} onChange={setDensity} />
          </div>
        </div>

        {/* Main: cards + event log */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Children grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Oturumlar yükleniyor...</p>
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Baby className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {searchQuery || filter !== "all" ? "Filtreye uyan çocuk yok" : "Oyun alanı boş"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {searchQuery || filter !== "all"
                      ? "Filtreyi değiştirmeyi dene"
                      : "Hızlı kayıttan giriş yaptırabilirsin"}
                  </p>
                </div>
              </div>
            ) : density === "dense" ? (
              /* High-density grid — 20-30 kids visible on a tablet */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
                {sorted.map((session) => (
                  <CompactSessionCard
                    key={session.id}
                    session={session}
                    onExtend={(id) => setExtendTarget(sessions.find((s) => s.id === id) ?? null)}
                    onCancel={(id) => setCancelTarget(sessions.find((s) => s.id === id) ?? null)}
                    onPause={handlePause}
                    onResume={handleResume}
                    onExit={handleExit}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
                {sorted.map((session) => (
                  <ActiveChildCard
                    key={session.id}
                    session={session}
                    onExtend={(id) => setExtendTarget(sessions.find((s) => s.id === id) ?? null)}
                    onCancel={(id) => setCancelTarget(sessions.find((s) => s.id === id) ?? null)}
                    onPause={handlePause}
                    onResume={handleResume}
                    onExit={handleExit}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Live event log */}
          <div className="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0 overflow-hidden">
            <LiveEventLog events={events} />
          </div>
        </div>

        {/* Bottom status bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 dark:bg-slate-950 text-xs text-slate-400 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Realtime aktif
            </span>
            <span className="hidden sm:block">Supabase Realtime bağlı</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{sessions.length} aktif oturum</span>
            <span className="hidden sm:block">GoKids Play v2.1</span>
          </div>
        </div>
      </div>

      {extendSession && (
        <ExtendTimeModal
          session={extendSession}
          onClose={() => setExtendTarget(null)}
        />
      )}

      {cancelSession && (
        <CancelSessionModal
          session={cancelSession}
          onClose={() => setCancelTarget(null)}
          onCancelled={() => {
            setCancelTarget(null)
            exit(cancelSession.id)
          }}
        />
      )}

      {endTarget && (
        <EndSessionModal
          session={endTarget}
          onClose={() => setEndTarget(null)}
          onConfirm={handleConfirmEnd}
        />
      )}

      {/* Manager-only completion history overlay */}
      {canSeeHistory && historyOpen && (
        <CompletionHistoryPanel onClose={() => setHistoryOpen(false)} />
      )}

      {/* Manager-only floating "Tamamlanan Oturumlar" button */}
      {canSeeHistory && !historyOpen && (
        <button
          onClick={() => setHistoryOpen(true)}
          className="fixed bottom-16 right-6 z-30 px-4 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-500/30 inline-flex items-center gap-2"
        >
          Tamamlanan Oturumlar
        </button>
      )}
    </MainLayout>
  )
}
