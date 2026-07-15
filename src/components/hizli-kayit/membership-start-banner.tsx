"use client"

import { Sparkles, Clock, Coffee, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MembershipRuleStatus } from "@/types/membership"

// ─── Membership Start Banner (Hızlı Kayıt) ───────────────────────────────────
//
// For the currently-selected child, if they hold an active monthly membership
// this surfaces today's entitlement and a one-tap "start on membership" toggle
// (a ₺0 tracked session). Weekday → unlimited; weekend → the remaining daily
// allowance (blocked once the 180 min/day cap is reached). Purely additive:
// when the child has no membership, the component renders nothing.

interface Props {
  status: MembershipRuleStatus | null | undefined
  /** Whether this child is currently set to start on the membership. */
  active: boolean
  onToggle: (on: boolean) => void
}

export function MembershipStartBanner({ status, active, onToggle }: Props) {
  if (!status || !status.hasMembership) return null

  const weekday = status.isWeekdayUnlimited === true
  const remaining = status.weekendRemainingMinutes ?? 0
  const exhausted = !weekday && remaining <= 0

  return (
    <div className={cn(
      "rounded-2xl border p-3 space-y-2",
      active
        ? "border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30"
        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
    )}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 dark:text-white truncate">
            {status.packageName || "Aylık Üyelik"}
          </p>
          {weekday ? (
            <p className="text-xs font-bold text-violet-600 dark:text-violet-300">Sınırsız Üyelik · Hafta İçi</p>
          ) : exhausted ? (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">Günlük hak doldu (180 dk)</p>
          ) : (
            <p className="text-xs font-bold text-violet-600 dark:text-violet-300 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Kalan Günlük Hak: {remaining} dakika
            </p>
          )}
        </div>
      </div>

      {status.brewmoodDiscountPct != null && status.brewmoodDiscountPct > 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Coffee className="w-3 h-3" /> Brewmood kahvede %{status.brewmoodDiscountPct} indirim
        </p>
      )}

      <button
        type="button"
        disabled={exhausted}
        onClick={() => onToggle(!active)}
        className={cn(
          "w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors",
          exhausted
            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
            : active
              ? "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/50"
              : "bg-violet-600 hover:bg-violet-500 text-white",
        )}
      >
        {active
          ? (<><X className="w-4 h-4" /> Üyeliği Kaldır</>)
          : (<><Check className="w-4 h-4" /> Üyelikle Başlat (₺0)</>)}
      </button>
    </div>
  )
}
