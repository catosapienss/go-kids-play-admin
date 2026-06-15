"use client"

import { type LucideIcon, RefreshCw, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Reusable empty state ─────────────────────────────────────────────────────
//
// Use this when:
//   • A panel returned no data ("no sessions yet")
//   • A query failed and the user should retry
//   • A feature is not yet wired up ("foundation pending")

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  body?: string
  /** When provided, renders a "Tekrar dene" button that calls this. */
  onRetry?: () => void
  retryLabel?: string
  /** Optional CTA shown alongside / instead of retry. */
  action?: { label: string; onClick: () => void; href?: string }
  className?: string
  tone?: "default" | "danger"
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  onRetry,
  retryLabel = "Tekrar dene",
  action,
  className,
  tone = "default",
}: EmptyStateProps) {
  const toneCfg = tone === "danger"
    ? { iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400", titleFg: "text-rose-700 dark:text-rose-300" }
    : { iconBg: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400", titleFg: "text-slate-800 dark:text-slate-100" }

  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-10 px-6", className)}>
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-3", toneCfg.iconBg)}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className={cn("text-sm font-bold mb-1", toneCfg.titleFg)}>{title}</h3>
      {body && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-4">
          {body}
        </p>
      )}
      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-3 h-3" />
            {retryLabel}
          </button>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300 text-xs font-semibold hover:bg-violet-500/15 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
