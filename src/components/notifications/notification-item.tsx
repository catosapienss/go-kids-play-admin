"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Sparkles,
  Wallet,
  Cake,
  AlertOctagon,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  formatRelativeTime,
  SEVERITY_TONE,
  type AppNotification,
  type NotificationCategory,
} from "@/types/notifications"

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  session:      Clock,
  payment:      CreditCard,
  wallet:       Wallet,
  refund:       AlertTriangle,
  organization: Cake,
  system:       AlertOctagon,
}

interface Props {
  notification: AppNotification
  onClick: () => void
  onDismiss: () => void
  onMarkRead: () => void
}

export function NotificationItem({ notification: n, onClick, onDismiss }: Props) {
  const Icon = n.severity === "success"
    ? CheckCircle2
    : (CATEGORY_ICON[n.category] ?? Sparkles)
  const tone = SEVERITY_TONE[n.severity]

  // Live-ticking relative time
  const [rel, setRel] = useState(() => formatRelativeTime(n.createdAt))
  useEffect(() => {
    const id = setInterval(() => setRel(formatRelativeTime(n.createdAt)), 30_000)
    return () => clearInterval(id)
  }, [n.createdAt])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick() }}
      className={cn(
        "group relative flex gap-3 px-4 py-3 cursor-pointer transition-colors",
        "hover:bg-slate-50 dark:hover:bg-slate-800/60",
        !n.read && "bg-violet-50/40 dark:bg-violet-500/[0.04]",
      )}
    >
      {/* Unread indicator */}
      {!n.read && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-500" />
      )}

      {/* Icon */}
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
        tone.iconBg,
      )}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-sm leading-snug truncate",
            !n.read ? "font-semibold text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300",
          )}>
            {n.title}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 tabular-nums">
            {rel}
          </span>
        </div>
        {n.body && (
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {n.body}
          </p>
        )}
        {n.action && (
          <p className={cn("text-[11px] font-semibold mt-1.5", tone.fg)}>
            {n.action.label} →
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        aria-label="Bildirimi kaldır"
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        className="absolute top-2 right-2 w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
