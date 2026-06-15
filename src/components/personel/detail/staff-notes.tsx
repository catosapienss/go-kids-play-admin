"use client"

import { useState } from "react"
import { StickyNote, TrendingUp, Activity, UserCheck, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StaffMember, NoteType } from "@/types/personel"

const NOTE_META: Record<NoteType, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  performance: {
    icon: TrendingUp, color: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-500/5", border: "border-violet-200 dark:border-violet-500/20",
    label: "Performans",
  },
  operation: {
    icon: Activity, color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/5", border: "border-amber-200 dark:border-amber-500/20",
    label: "Operasyon",
  },
  manager: {
    icon: UserCheck, color: "text-sky-700 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-500/5", border: "border-sky-200 dark:border-sky-500/20",
    label: "Yönetici",
  },
}

export function StaffNotes({ staff }: { staff: StaffMember }) {
  const [adding, setAdding] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [noteType, setNoteType] = useState<NoteType>("operation")

  return (
    <div className="space-y-4">
      {/* Add note button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{staff.notes.length} Not</p>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Not Ekle
        </button>
      </div>

      {/* Add note form */}
      {adding && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-violet-200 dark:border-violet-500/30 p-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Yeni Not</p>
          {/* Type selector */}
          <div className="flex gap-2">
            {(Object.keys(NOTE_META) as NoteType[]).map((t) => {
              const meta = NOTE_META[t]
              return (
                <button
                  key={t}
                  onClick={() => setNoteType(t)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors",
                    noteType === t
                      ? cn(meta.bg, meta.color, meta.border)
                      : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  )}
                >
                  <meta.icon className="w-3 h-3" />
                  {meta.label}
                </button>
              )
            })}
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Not içeriğini yazın..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setAdding(false); setNoteText("") }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 transition-colors"
            >
              Vazgeç
            </button>
            <button
              disabled={!noteText.trim()}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-colors",
                noteText.trim()
                  ? "bg-violet-600 hover:bg-violet-700 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
              )}
              onClick={() => { setAdding(false); setNoteText("") }}
            >
              Kaydet
            </button>
          </div>
        </div>
      )}

      {/* Note cards */}
      {staff.notes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
          <StickyNote className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Henüz not eklenmemiş</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.notes.map((note) => {
            const meta = NOTE_META[note.type]
            const Icon = meta.icon
            return (
              <div key={note.id} className={cn("rounded-2xl p-4 border", meta.bg, meta.border)}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-wide", meta.color)}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-400">{note.datetime.split(" ")[0].slice(5).replace("-", "/")}</p>
                    <p className="text-[10px] text-slate-400">{note.authorName}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">{note.content}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
