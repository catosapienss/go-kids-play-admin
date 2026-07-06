"use client"

import { useEffect, useState } from "react"
import { NotebookPen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBranchScope } from "@/lib/branch/branch-context"
import { listTodayOperationNotes } from "@/lib/services/operations-log.service"
import { DailyNotesPanel } from "./daily-notes-panel"

// ─── Header quick-access: Daily Notes ────────────────────────────────────────
//
// A single header button that opens the shift-log side panel. Shows a small
// count badge of today's notes so staff know there's context to read.

export function DailyNotesButton() {
  const scope = useBranchScope()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState<number | null>(null)

  // Light background load so the badge reflects today's note count.
  useEffect(() => {
    let cancelled = false
    listTodayOperationNotes(scope, "desc")
      .then((r) => { if (!cancelled) setCount(r.length) })
      .catch(() => { /* best-effort */ })
    return () => { cancelled = true }
  }, [scope])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Günlük Notlar — vardiya defteri"
        aria-label="Günlük Notlar"
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <NotebookPen className="h-4 w-4" />
        {!!count && count > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-violet-600 text-white",
            "text-[10px] font-bold flex items-center justify-center tabular-nums",
          )}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      <DailyNotesPanel open={open} onClose={() => setOpen(false)} onCountChange={setCount} />
    </>
  )
}
