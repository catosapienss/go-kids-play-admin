"use client"

import { CheckCircle2, Pause, Hourglass, X, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  STATUS_LABEL, STATUS_TONE, isExpiringSoon, type Membership, type MembershipStatus,
} from "@/types/membership"

// ─── MembershipStatusBadge ────────────────────────────────────────────────────
//
// One compact pill that reflects every membership state — including the
// derived "expiring soon" warning we surface when ends_at is < 7 days away.

const ICON: Record<MembershipStatus, typeof CheckCircle2> = {
  active:    CheckCircle2,
  paused:    Pause,
  expired:   Hourglass,
  cancelled: X,
}

interface Props {
  membership: Membership
  size?: "sm" | "md"
  className?: string
}

export function MembershipStatusBadge({ membership, size = "sm", className }: Props) {
  // Derived "expiring soon" override — visual only, doesn't change DB status.
  const expiring = membership.status === "active" && isExpiringSoon(membership)

  if (expiring) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider",
        "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        className,
      )}>
        <AlertTriangle className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
        Yakında Bitiyor
      </span>
    )
  }

  const Icon = ICON[membership.status]
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider",
      STATUS_TONE[membership.status],
      size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
      className,
    )}>
      <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {STATUS_LABEL[membership.status]}
    </span>
  )
}
