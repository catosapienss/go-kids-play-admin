"use client"

import { Crown, Sparkles, Repeat, User } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  computeTier, TIER_LABEL, TIER_TONE,
  type CustomerSummary, type LoyaltyTier,
} from "@/types/customer"

// ─── LoyaltyBadge ─────────────────────────────────────────────────────────────
//
// Compact pill showing the derived loyalty tier (VIP / Frequent / Regular / New).
// Pure presentation — the tier is computed client-side from visit + spend +
// is_vip override. No DB column yet (foundation only, per the brief).

const ICON: Record<LoyaltyTier, typeof Crown> = {
  vip:      Crown,
  frequent: Sparkles,
  regular:  Repeat,
  new:      User,
}

interface Props {
  customer: Pick<CustomerSummary, "visitCount" | "totalSpent" | "isVip">
  size?: "sm" | "md"
  showLabel?: boolean
  className?: string
}

export function LoyaltyBadge({ customer, size = "sm", showLabel = true, className }: Props) {
  const tier = computeTier(customer)
  const Icon = ICON[tier]
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider",
      TIER_TONE[tier],
      size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
      className,
    )}>
      <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {showLabel && TIER_LABEL[tier]}
    </span>
  )
}
