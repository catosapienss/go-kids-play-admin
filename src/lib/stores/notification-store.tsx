"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"
import type {
  AppNotification,
  NewNotification,
  NotificationCategory,
} from "@/types/notifications"

// ─── Public API ───────────────────────────────────────────────────────────────

interface NotificationStoreValue {
  notifications: AppNotification[]
  unreadCount: number
  /** Add a new notification. Returns the generated id. */
  push: (n: NewNotification) => string
  markRead: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
  clear: () => void
  /** Subscribe to brand-new notifications (after dedupe). Returns unsubscribe. */
  onNew: (handler: (n: AppNotification) => void) => () => void
}

const NotificationStoreContext = createContext<NotificationStoreValue | null>(null)

// ─── Implementation details ───────────────────────────────────────────────────

const MAX_RETAINED = 200          // bounded buffer
const DEDUPE_WINDOW_MS = 30_000   // ignore identical notifications < 30s apart

function genId(): string {
  return `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** Stable signature for dedupe — title + category + sessionId (if any). */
function signature(n: NewNotification): string {
  return `${n.category}|${n.title}|${n.sessionId ?? ""}|${n.parentId ?? ""}`
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationStoreProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const recentSignaturesRef = useRef<Map<string, number>>(new Map())
  const listenersRef = useRef<Set<(n: AppNotification) => void>>(new Set())

  const push = useCallback((input: NewNotification): string => {
    const sig = signature(input)
    const now = Date.now()
    const lastSeen = recentSignaturesRef.current.get(sig)
    if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
      return "" // suppressed
    }
    recentSignaturesRef.current.set(sig, now)

    // Trim dedupe map to last 50 sigs
    if (recentSignaturesRef.current.size > 50) {
      const arr = Array.from(recentSignaturesRef.current.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
      recentSignaturesRef.current = new Map(arr)
    }

    const n: AppNotification = {
      id: genId(),
      createdAt: now,
      read: false,
      ...input,
    }

    setNotifications((prev) => {
      const next = [n, ...prev]
      return next.length > MAX_RETAINED ? next.slice(0, MAX_RETAINED) : next
    })

    // Fire listeners (next microtask to avoid setState-during-render)
    queueMicrotask(() => {
      listenersRef.current.forEach((fn) => {
        try { fn(n) } catch { /* swallow */ }
      })
    })

    return n.id
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })))
  }, [])

  const remove = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clear = useCallback(() => {
    setNotifications([])
    recentSignaturesRef.current.clear()
  }, [])

  const onNew = useCallback((handler: (n: AppNotification) => void) => {
    listenersRef.current.add(handler)
    return () => { listenersRef.current.delete(handler) }
  }, [])

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [notifications],
  )

  const value = useMemo<NotificationStoreValue>(() => ({
    notifications,
    unreadCount,
    push,
    markRead,
    markAllRead,
    remove,
    clear,
    onNew,
  }), [notifications, unreadCount, push, markRead, markAllRead, remove, clear, onNew])

  return (
    <NotificationStoreContext.Provider value={value}>
      {children}
    </NotificationStoreContext.Provider>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useNotificationStore(): NotificationStoreValue {
  const ctx = useContext(NotificationStoreContext)
  if (!ctx) {
    throw new Error(
      "useNotificationStore must be used within a <NotificationStoreProvider>.",
    )
  }
  return ctx
}

export function useFilteredNotifications(
  category: NotificationCategory | "all" = "all",
  onlyUnread = false,
): AppNotification[] {
  const { notifications } = useNotificationStore()
  return useMemo(() => {
    return notifications.filter((n) =>
      (category === "all" || n.category === category)
      && (!onlyUnread || !n.read),
    )
  }, [notifications, category, onlyUnread])
}
