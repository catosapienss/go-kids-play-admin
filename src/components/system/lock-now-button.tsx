"use client"

import { Lock } from "lucide-react"
import { useSessionLock } from "@/contexts/session-lock-context"
import { useAuth } from "@/contexts/auth-context"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// ─── Manual lock-now button ──────────────────────────────────────────────────
//
// Sits in the app header. Available to every signed-in user. Clicking it
// hands control to the SessionLockProvider — the existing PIN screen takes
// over and returns the user to the current page on unlock.

export function LockNowButton({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const { lockNow } = useSessionLock()
  if (!user) return null

  const button = (
    <button
      type="button"
      onClick={lockNow}
      aria-label="Oturumu kilitle"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
    >
      <Lock className="w-3.5 h-3.5" />
      {!compact && <span>Kilitle</span>}
    </button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom">PIN ile geri dön (15 dk hareketsizlik zaten otomatik kilitliyor)</TooltipContent>
    </Tooltip>
  )
}
