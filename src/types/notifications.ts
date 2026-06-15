// ─── Notification type system ────────────────────────────────────────────────
//
// Every notification flowing through the engine conforms to AppNotification.
// Components, hooks, services, and channel adapters all share these types.

export type NotificationSeverity = "info" | "success" | "warning" | "critical"

export type NotificationCategory =
  | "session"        // entry/exit, expiring, expired
  | "payment"        // payment success/failure
  | "wallet"         // load, low balance, refund credit
  | "refund"         // cancel/refund processed
  | "organization"   // upcoming events / birthdays
  | "system"         // POS timeout, duplicate, sync error

/** Where the alert was emitted from — useful for analytics later. */
export type NotificationSource =
  | "realtime"       // supabase channel
  | "session-tick"   // local countdown watcher
  | "user-action"    // manual emit from a UI flow
  | "system"         // health-check / error boundary

export interface NotificationAction {
  label: string
  /** Either a route to navigate to, or a click handler — UI picks. */
  href?: string
  onClick?: () => void
  variant?: "default" | "primary" | "danger"
}

export interface AppNotification {
  id: string
  createdAt: number              // epoch ms
  category: NotificationCategory
  severity: NotificationSeverity
  source: NotificationSource

  title: string
  body?: string

  /** Optional contextual references (kept loose for now). */
  sessionId?: string
  parentId?: string
  childName?: string

  /** Inline action shown on the notification card. */
  action?: NotificationAction

  read: boolean
  /** True if the notification should NOT show a toast (e.g. background sync events). */
  silent?: boolean
}

export type NewNotification = Omit<AppNotification, "id" | "createdAt" | "read">

// ─── Category metadata for UI ─────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  session:      "Oturum",
  payment:      "Ödeme",
  wallet:       "Cüzdan",
  refund:       "İade",
  organization: "Organizasyon",
  system:       "Sistem",
}

export const SEVERITY_TONE: Record<NotificationSeverity, {
  dot:    string
  iconBg: string
  ring:   string
  fg:     string
}> = {
  info: {
    dot:    "bg-blue-500",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    ring:   "ring-blue-500/20",
    fg:     "text-blue-700 dark:text-blue-300",
  },
  success: {
    dot:    "bg-emerald-500",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    ring:   "ring-emerald-500/20",
    fg:     "text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    dot:    "bg-amber-500",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    ring:   "ring-amber-500/20",
    fg:     "text-amber-700 dark:text-amber-300",
  },
  critical: {
    dot:    "bg-rose-500",
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    ring:   "ring-rose-500/20",
    fg:     "text-rose-700 dark:text-rose-300",
  },
}

// ─── Time formatting helper ───────────────────────────────────────────────────

export function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  const s = Math.floor(diff / 1000)
  if (s < 5) return "şimdi"
  if (s < 60) return `${s} sn önce`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} dk önce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} sa önce`
  const d = Math.floor(h / 24)
  return `${d} gün önce`
}
