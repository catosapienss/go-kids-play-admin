"use client"

import { NotebookPen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OperationNote } from "@/types/operations-log"

// ─── Operation notes timeline (read-only) ────────────────────────────────────
//
// Shared notebook/timeline layout used by End-of-Day and Reports. Each entry
// reads "HH:mm – Staff" then the note body, easy to scan at a glance.

function hm(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => (n < 10 ? "0" + n : String(n))
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
function dmy(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => (n < 10 ? "0" + n : String(n))
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

interface Props {
  notes:     OperationNote[]
  /** Show the date next to the time (used in reports spanning multiple days). */
  showDate?: boolean
  emptyText?: string
  className?: string
}

export function OperationNotesTimeline({ notes, showDate, emptyText, className }: Props) {
  if (notes.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
        <NotebookPen className="w-6 h-6 opacity-40" />
        {emptyText ?? "Bugün için not yok"}
      </div>
    )
  }

  return (
    <ol className={cn("relative border-l border-slate-200 dark:border-slate-700 ml-2 space-y-3", className)}>
      {notes.map((n) => (
        <li key={n.id} className="ml-4">
          <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-violet-500 border-2 border-white dark:border-slate-900" />
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
              {showDate ? `${dmy(n.createdAt)} ${hm(n.createdAt)}` : hm(n.createdAt)}
            </span>
            <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">
              {n.createdByName ?? "Personel"}
            </span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug mt-0.5 whitespace-pre-wrap break-words">
            {n.note}
          </p>
        </li>
      ))}
    </ol>
  )
}
