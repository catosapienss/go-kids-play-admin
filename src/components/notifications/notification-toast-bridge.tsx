"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useNotificationStore } from "@/lib/stores/notification-store"
import { useSettingsSection } from "@/lib/settings/settings-store"
import { isMuted, playSound, severityToSound } from "@/lib/services/feedback-sounds"
import type { AppNotification, NotificationSeverity } from "@/types/notifications"

// ─── Toast + sound bridge ────────────────────────────────────────────────────
//
// Subscribes to onNew() from the notification store and:
//   1. Plays a subtle tone (unless muted or notification is `silent`)
//   2. Shows a sonner toast with the right tone + optional action
//
// Mounting this component once at the app root is enough — no props needed.

function toastFor(n: AppNotification, severity: NotificationSeverity, onAction?: () => void) {
  const opts = {
    description: n.body,
    duration: severity === "critical" ? 8_000 : severity === "warning" ? 6_000 : 4_000,
    action: n.action
      ? { label: n.action.label, onClick: onAction ?? (() => undefined) }
      : undefined,
  }
  switch (severity) {
    case "success":  return toast.success(n.title, opts)
    case "warning":  return toast.warning(n.title, opts)
    case "critical": return toast.error(n.title, opts)
    default:         return toast.message(n.title, opts)
  }
}

export function NotificationToastBridge() {
  const { onNew } = useNotificationStore()
  const router = useRouter()
  // Operator-configurable: settings → soundsEnabled & operationalWarnings toggles.
  const notifSettings = useSettingsSection("notifications")
  const soundsEnabledRef = useRef(notifSettings.soundsEnabled)
  const opWarningsRef    = useRef(notifSettings.operationalWarnings)
  useEffect(() => { soundsEnabledRef.current = notifSettings.soundsEnabled }, [notifSettings.soundsEnabled])
  useEffect(() => { opWarningsRef.current    = notifSettings.operationalWarnings }, [notifSettings.operationalWarnings])

  useEffect(() => {
    return onNew((n) => {
      if (n.silent) return
      // Respect operator preference for system/operational category warnings.
      if (n.category === "system" && !opWarningsRef.current) return

      // Sound — gated by both the localStorage mute toggle AND the operator pref.
      if (soundsEnabledRef.current && !isMuted()) {
        playSound(severityToSound(n.severity))
      }

      // Toast
      toastFor(n, n.severity, () => {
        if (n.action?.href) router.push(n.action.href)
        else n.action?.onClick?.()
      })
    })
  }, [onNew, router])

  return null
}
