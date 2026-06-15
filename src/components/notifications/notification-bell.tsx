"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, BellRing } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotificationStore } from "@/lib/stores/notification-store"
import { NotificationPanel } from "./notification-panel"

// ─── Header bell with badge + dropdown panel ──────────────────────────────────

export function NotificationBell() {
  const { unreadCount, notifications } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const [ringPulse, setRingPulse] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const lastSeenCountRef = useRef(unreadCount)

  // Subtle ring pulse when a new unread arrives (badge keeps the count).
  useEffect(() => {
    if (unreadCount > lastSeenCountRef.current) {
      setRingPulse(true)
      const t = setTimeout(() => setRingPulse(false), 1200)
      return () => clearTimeout(t)
    }
    lastSeenCountRef.current = unreadCount
  }, [unreadCount])

  // Close panel on outside click / escape.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const displayCount = unreadCount > 99 ? "99+" : unreadCount

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Bildirimler"
        className={cn(
          "relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
          "text-slate-600 dark:text-slate-300",
          "hover:bg-slate-100 dark:hover:bg-slate-800",
          open && "bg-slate-100 dark:bg-slate-800",
        )}
      >
        {ringPulse
          ? <BellRing className="w-4 h-4 animate-[wiggle_1.2s_ease-in-out]" />
          : <Bell className="w-4 h-4" />
        }
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full",
            "bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center",
            "ring-2 ring-white dark:ring-slate-900",
          )}>
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-12 z-50 w-[380px] max-w-[calc(100vw-1rem)]",
            "rounded-2xl border border-slate-200 dark:border-slate-800",
            "bg-white dark:bg-slate-900",
            "shadow-2xl shadow-slate-900/10 dark:shadow-black/30",
            "overflow-hidden",
            "animate-[fadeInDown_140ms_ease-out]",
          )}
        >
          <NotificationPanel
            notifications={notifications}
            onClose={() => setOpen(false)}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0); }
          15%      { transform: rotate(-12deg); }
          30%      { transform: rotate(10deg); }
          45%      { transform: rotate(-8deg); }
          60%      { transform: rotate(6deg); }
          75%      { transform: rotate(-3deg); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
