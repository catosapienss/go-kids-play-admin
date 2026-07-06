"use client"

import { useEffect, useState } from "react"
import { NotebookPen, Loader2 } from "lucide-react"
import { useBranchScope } from "@/lib/branch/branch-context"
import { listTodayOperationNotes } from "@/lib/services/operations-log.service"
import { OperationNotesTimeline } from "@/components/operations-log/operation-notes-timeline"
import type { OperationNote } from "@/types/operations-log"

// ─── End-of-Day · Daily Operations Notes ─────────────────────────────────────
//
// Read-only chronological view of today's shift notes, shown during closing so
// managers/owners can review operational context before finalising the day.

export function DailyOperationsNotesSection() {
  const scope = useBranchScope()
  const [notes, setNotes] = useState<OperationNote[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listTodayOperationNotes(scope, "asc")
      .then((r) => { if (!cancelled) setNotes(r) })
      .catch(() => { if (!cancelled) setNotes([]) })
    return () => { cancelled = true }
  }, [scope])

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 flex items-center justify-center">
            <NotebookPen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Günlük Operasyon Notları</h2>
            <p className="text-[11px] text-slate-500">Kapanıştan önce vardiya notlarını gözden geçir</p>
          </div>
        </div>
        {notes && <span className="text-[11px] font-bold text-slate-500 tabular-nums">{notes.length} not</span>}
      </div>

      <div className="px-5 py-4">
        {notes === null ? (
          <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
        ) : (
          <OperationNotesTimeline notes={notes} emptyText="Bugün operasyon notu girilmedi" />
        )}
      </div>
    </div>
  )
}
