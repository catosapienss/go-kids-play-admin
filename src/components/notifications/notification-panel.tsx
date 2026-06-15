"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, CheckCheck, Volume2, VolumeX, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotificationStore } from "@/lib/stores/notification-store"
import { isMuted, setMuted } from "@/lib/services/feedback-sounds"
import {
  CATEGORY_LABELS,
  type AppNotification,
  type NotificationCategory,
} from "@/types/notifications"
import { NotificationItem } from "./notification-item"

type FilterTab = "all" | "unread" | NotificationCategory

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all",          label: "Tümü" },
  { id: "unread",       label: "Okunmamış" },
  { id: "session",      label: CATEGORY_LABELS.session },
  { id: "payment",      label: CATEGORY_LABELS.payment },
  { id: "wallet",       label: CATEGORY_LABELS.wallet },
  { id: "organization", label: CATEGORY_LABELS.organization },
  { id: "system",       label: CATEGORY_LABELS.system },
]

interface Props {
  notifications: AppNotification[]
  onClose: () => void
}

export function NotificationPanel({ notifications, onClose }: Props) {
  const { markRead, markAllRead, remove, unreadCount } = useNotificationStore()
  const router = useRouter()
  const [tab, setTab] = useState<FilterTab>("all")
  const [muted, setMutedState] = useState(() => isMuted())

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  const filtered = notifications.filter((n) => {
    if (tab === "all")    return true
    if (tab === "unread") return !n.read
    return n.category === tab
  })

  function handleItemClick(n: AppNotification) {
    if (!n.read) markRead(n.id)
    if (n.action?.href) {
      router.push(n.action.href)
      onClose()
    } else if (n.action?.onClick) {
      n.action.onClick()
    }
  }

  return (
    <div className="flex flex-col max-h-[560px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bildirimler</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {unreadCount > 0 ? `${unreadCount} okunmamış` : "Hepsi okundu"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? "Sesi aç" : "Sessize al"}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              title="Tümünü okundu işaretle"
              className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10"
            >
              <CheckCheck className="w-3 h-3" />
              <span className="hidden sm:inline">Tümünü oku</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 pb-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors",
                  active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto border-t border-slate-100 dark:border-slate-800 min-h-[200px]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <Inbox className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Bildirim yok</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Operasyon güncellemeleri burada görünecek.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {filtered.map((n) => (
              <li key={n.id}>
                <NotificationItem
                  notification={n}
                  onClick={() => handleItemClick(n)}
                  onDismiss={() => remove(n.id)}
                  onMarkRead={() => markRead(n.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-center">
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600"
        >
          <Check className="w-3 h-3 inline mr-1" />
          Kapat
        </button>
      </div>
    </div>
  )
}
