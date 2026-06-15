"use client"

import { RealtimeAlertEngine } from "./realtime-alert-engine"
import { SessionAlertWatcher } from "./session-alert-watcher"
import { OrganizationReminderWatcher } from "./organization-reminder-watcher"
import { NotificationToastBridge } from "./notification-toast-bridge"
import { ExpiringSessionsStrip } from "./expiring-sessions-strip"

// ─── Single mount-point for every alert engine subsystem ─────────────────────
//
// Mount this once inside MainLayout (i.e. only for authenticated pages, so we
// don't run a Supabase subscription on the public login screen).

export function AlertEngineMount() {
  return (
    <>
      <RealtimeAlertEngine />
      <SessionAlertWatcher />
      <OrganizationReminderWatcher />
      <NotificationToastBridge />
      <ExpiringSessionsStrip />
    </>
  )
}
