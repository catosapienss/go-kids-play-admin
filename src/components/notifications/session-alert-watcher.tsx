"use client"

import { useEffect, useRef } from "react"
import { useSessionStore } from "@/lib/stores/session-store"
import { useNotificationStore } from "@/lib/stores/notification-store"
import { useSettingsSection } from "@/lib/settings/settings-store"
import { getStatus } from "@/types/aktif-oyun"

// ─── Session Alert Watcher ────────────────────────────────────────────────────
//
// Walks the live sessions every second and emits notifications when a session
// crosses key thresholds: 10 min remaining (warning), 5 min (critical),
// 0 sec (expired-critical). Internal `seenRef` prevents re-firing once a
// threshold has been crossed for a given session.
//
// Sound + toast are handled by NotificationToastBridge, which subscribes to
// store onNew events — this watcher just produces clean state transitions.

type Threshold = "warn10" | "warn5" | "expired"

export function SessionAlertWatcher() {
  const { sessions } = useSessionStore()
  const { push } = useNotificationStore()
  // Operator-configurable thresholds from settings panel (in minutes).
  const notif = useSettingsSection("notifications")
  const seenRef = useRef<Map<string, Set<Threshold>>>(new Map())

  // Hot refs so the interval sees the latest sessions + thresholds without
  // re-creating the timer every render.
  const sessionsRef = useRef(sessions)
  useEffect(() => { sessionsRef.current = sessions }, [sessions])

  const thresholdsRef = useRef({
    warnSecs:     notif.sessionEndingWarnMin     * 60,
    criticalSecs: notif.sessionEndingCriticalMin * 60,
  })
  useEffect(() => {
    thresholdsRef.current = {
      warnSecs:     notif.sessionEndingWarnMin     * 60,
      criticalSecs: notif.sessionEndingCriticalMin * 60,
    }
  }, [notif.sessionEndingWarnMin, notif.sessionEndingCriticalMin])

  useEffect(() => {
    function tick() {
      const seen = seenRef.current
      const liveIds = new Set<string>()
      const { warnSecs, criticalSecs } = thresholdsRef.current

      for (const s of sessionsRef.current) {
        liveIds.add(s.id)
        if (s.totalMinutes === 0) continue        // unlimited — never alerts
        if (s.isPaused) continue                  // paused — clock isn't moving

        const status = getStatus(s)
        const fired = seen.get(s.id) ?? new Set<Threshold>()
        const secs = s.remainingSeconds
        const warnMin     = Math.round(warnSecs / 60)
        const criticalMin = Math.round(criticalSecs / 60)

        // 0 sec → expired (critical)
        if (status === "expired" && !fired.has("expired")) {
          fired.add("expired")
          push({
            category: "session",
            severity: "critical",
            source:   "session-tick",
            title:    `${s.childName} süresi bitti`,
            body:     `Çıkış işlemi veya uzatma gerekli.`,
            sessionId: s.id,
            childName: s.childName,
            action: { label: "Aktif oyuna git", href: "/aktif-oyun" },
          })
        }
        // ≤ critical threshold → critical
        else if (secs > 0 && secs <= criticalSecs && !fired.has("warn5")) {
          fired.add("warn5")
          push({
            category: "session",
            severity: "critical",
            source:   "session-tick",
            title:    `${s.childName} · ${criticalMin} dk kaldı`,
            body:     `Veliyi bilgilendir veya uzatma sun.`,
            sessionId: s.id,
            childName: s.childName,
            action: { label: "Uzat / Detay", href: "/aktif-oyun" },
          })
        }
        // ≤ warn threshold → warning
        else if (secs > criticalSecs && secs <= warnSecs && !fired.has("warn10")) {
          fired.add("warn10")
          push({
            category: "session",
            severity: "warning",
            source:   "session-tick",
            title:    `${s.childName} · ${warnMin} dk kaldı`,
            body:     `Süre bitmek üzere.`,
            sessionId: s.id,
            childName: s.childName,
          })
        }

        seen.set(s.id, fired)
      }

      // Clean up entries for sessions that left the floor
      Array.from(seen.keys()).forEach((id) => {
        if (!liveIds.has(id)) seen.delete(id)
      })
    }

    // First-run + every second.
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [push])

  return null
}
