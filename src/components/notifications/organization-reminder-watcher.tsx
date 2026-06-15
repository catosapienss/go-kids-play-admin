"use client"

import { useEffect } from "react"
import { useNotificationStore } from "@/lib/stores/notification-store"
import { getEventSummary } from "@/lib/services/analytics.service"

// ─── Organization & Birthday Reminder Watcher ─────────────────────────────────
//
// Polls upcoming events every 5 minutes (cheap query, defensive fallback) and
// emits reminders for organizations starting in < 60 minutes. Today-only
// birthdays are surfaced once per session.

const POLL_MS = 5 * 60_000     // 5 min
const SOON_THRESHOLD_MS = 60 * 60_000  // 60 min

export function OrganizationReminderWatcher() {
  const { push } = useNotificationStore()

  useEffect(() => {
    let cancelled = false
    const seenOrgs = new Set<string>()
    let firedTodayBirthdayBanner = false

    async function tick() {
      try {
        const summary = await getEventSummary()
        if (cancelled) return

        if (!firedTodayBirthdayBanner && summary.todayBirthdays > 0) {
          firedTodayBirthdayBanner = true
          push({
            category: "organization",
            severity: "info",
            source: "system",
            title: `Bugün ${summary.todayBirthdays} doğum günü var`,
            body: "Hazırlık ve karşılama planını gözden geçir.",
            action: { label: "Doğum günleri", href: "/dogum-gunleri" },
          })
        }

        const now = Date.now()
        for (const o of summary.upcomingOrgs) {
          const sig = `${o.name}|${o.date}`
          if (seenOrgs.has(sig)) continue
          const t = new Date(o.date).getTime()
          if (Number.isNaN(t)) continue
          if (t > now && t - now <= SOON_THRESHOLD_MS) {
            seenOrgs.add(sig)
            const mins = Math.max(1, Math.round((t - now) / 60_000))
            push({
              category: "organization",
              severity: "warning",
              source: "system",
              title: `${o.name} başlıyor`,
              body: `${mins} dakika içinde · ${o.childCount} çocuk`,
              action: { label: "Detay", href: "/dogum-gunleri" },
            })
          }
        }
      } catch {
        // Silent — the event summary endpoint is best-effort.
      }
    }

    void tick()
    const id = setInterval(tick, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [push])

  return null
}
