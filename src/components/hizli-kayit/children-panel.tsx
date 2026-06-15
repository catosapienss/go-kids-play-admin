"use client"

import { Plus, Baby, Users } from "lucide-react"
import { ChildCard } from "./child-card"
import type { ChildEntry } from "@/types/hizli-kayit"

interface ChildrenPanelProps {
  kidsList: ChildEntry[]
  selectedChildId: string | null
  onAdd: () => void
  onSelect: (id: string) => void
  onUpdate: (id: string, updates: Partial<ChildEntry>) => void
  onRemove: (id: string) => void
  total: number
}

export function ChildrenPanel({
  kidsList,
  selectedChildId,
  onAdd,
  onSelect,
  onUpdate,
  onRemove,
  total,
}: ChildrenPanelProps) {
  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Çocuk Yönetimi</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {kidsList.length > 0 ? `${kidsList.length} çocuk eklendi` : "Çocuk ekle ve süre seç"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {kidsList.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-500/10 rounded-xl">
              <Users className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-sm font-bold text-violet-700 dark:text-violet-400">₺{total}</span>
            </div>
          )}
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-medium transition-colors shadow-sm shadow-violet-500/25"
          >
            <Plus className="w-3.5 h-3.5" />
            Çocuk Ekle
          </button>
        </div>
      </div>

      {/* Empty state */}
      {kidsList.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-500/10 dark:to-purple-500/10 flex items-center justify-center">
              <Baby className="w-10 h-10 text-violet-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shadow-lg">
              <Plus className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Çocuk eklenmedi</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Yukarıdaki butona tıkla</p>
          </div>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-violet-500/25 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            İlk Çocuğu Ekle
          </button>
        </div>
      )}

      {/* Child cards */}
      {kidsList.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-0.5">
          {kidsList.map((child, index) => (
            <ChildCard
              key={child.id}
              child={child}
              index={index}
              isSelected={child.id === selectedChildId}
              onSelect={() => onSelect(child.id)}
              onUpdate={(updates) => onUpdate(child.id, updates)}
              onRemove={() => onRemove(child.id)}
            />
          ))}

          {/* Add another */}
          <button
            onClick={onAdd}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-600 text-slate-400 hover:text-violet-500 text-sm font-medium transition-all flex items-center justify-center gap-2 group"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Başka Çocuk Ekle
          </button>
        </div>
      )}
    </div>
  )
}
