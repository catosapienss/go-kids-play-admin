"use client"

import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { usePresentationMode } from "@/lib/presentation/presentation-mode"

// ─── Header toggle for Presentation / Privacy Mode ───────────────────────────
//
// Admin-only. Masks customer PII across the UI for screenshots — display-only,
// never touches data. A slim banner (rendered separately) confirms it's on.

export function PresentationToggle() {
  const { user } = useAuth()
  const { enabled, toggle } = usePresentationMode()

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) return null

  return (
    <button
      type="button"
      onClick={toggle}
      title={enabled ? "Sunum modu açık — gizli veriler maskeli" : "Sunum modu (ekran görüntüsü için verileri maskele)"}
      aria-label="Sunum modu"
      className={cn(
        "hidden md:flex w-9 h-9 rounded-xl items-center justify-center transition-colors",
        enabled
          ? "bg-violet-600 text-white hover:bg-violet-500"
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200",
      )}
    >
      {enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  )
}

/** Thin banner shown under the header while presentation mode is active. */
export function PresentationBanner() {
  const { enabled, setEnabled } = usePresentationMode()
  if (!enabled) return null
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1 bg-violet-600 text-white text-[11px] font-semibold">
      <EyeOff className="w-3 h-3" />
      Sunum modu açık — müşteri verileri maskeleniyor (yalnızca görünüm; veriler değişmedi)
      <button onClick={() => setEnabled(false)} className="ml-2 underline underline-offset-2 hover:opacity-80">
        Kapat
      </button>
    </div>
  )
}
