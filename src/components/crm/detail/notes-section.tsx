import { StickyNote, AlertTriangle, XCircle, AlertCircle, MessageSquare, Plus } from "lucide-react"
import type { Customer, NoteType } from "@/types/crm"
import { cn } from "@/lib/utils"

const NOTE_META: Record<NoteType, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  general: {
    label: "Genel",
    icon: MessageSquare,
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-50 dark:bg-slate-800",
    border: "border-slate-200 dark:border-slate-700",
  },
  allergy: {
    label: "Alerji",
    icon: AlertTriangle,
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-500/5",
    border: "border-red-200 dark:border-red-500/20",
  },
  problem: {
    label: "Problem",
    icon: AlertCircle,
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-500/5",
    border: "border-amber-200 dark:border-amber-500/20",
  },
  cancellation: {
    label: "İptal",
    icon: XCircle,
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 dark:bg-orange-500/5",
    border: "border-orange-200 dark:border-orange-500/20",
  },
}

export function NotesSection({ customer }: { customer: Customer }) {
  return (
    <div className="space-y-4">
      {/* Add note button */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.staffNotes.length} not</p>
        <button className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm">
          <Plus className="w-3.5 h-3.5" />
          Not Ekle
        </button>
      </div>

      {customer.staffNotes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
          <StickyNote className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Henüz not yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customer.staffNotes.map((note) => {
            const meta = NOTE_META[note.type]
            const Icon = meta.icon
            return (
              <div key={note.id} className={cn("rounded-2xl border p-4 shadow-sm", meta.bg, meta.border)}>
                <div className="flex items-start gap-3">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", meta.bg)}>
                    <Icon className={cn("w-4 h-4", meta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-relaxed", meta.color)}>{note.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", meta.bg, meta.color)}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-slate-400">{note.staffName}</span>
                      <span className="text-[10px] text-slate-400">·</span>
                      <span className="text-[10px] text-slate-400">{note.date.slice(0, 10).replace(/-/g, "/")}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
