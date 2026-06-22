"use client"

import { Trash2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { DURATION_COLORS } from "@/lib/pos-data"
import { useSettingsSection } from "@/lib/settings/settings-store"
import type { ChildEntry, DurationOption } from "@/types/hizli-kayit"

// Map a settings package durationMin (any positive int, 0 = unlimited) to the
// closed DurationOption enum the session-creation pipeline expects.
function toDurationOption(durationMin: number): DurationOption {
  if (durationMin <= 0)  return "free"
  if (durationMin <= 30) return 30
  if (durationMin <= 60) return 60
  return 90
}

interface ChildCardProps {
  child: ChildEntry
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<ChildEntry>) => void
  onRemove: () => void
  index: number
}

const CARD_COLORS = [
  "from-violet-500 to-purple-600",
  "from-pink-500 to-rose-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-green-600",
  "from-orange-500 to-amber-600",
]

export function ChildCard({ child, isSelected, onSelect, onUpdate, onRemove, index }: ChildCardProps) {
  const colorClass = CARD_COLORS[index % CARD_COLORS.length]
  const packages = useSettingsSection("packages")
  const activeItems = packages.items.filter((p) => p.active)

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded-2xl border-2 cursor-pointer transition-all duration-200 overflow-hidden",
        isSelected
          ? "border-violet-500 shadow-lg shadow-violet-500/15 scale-[1.01]"
          : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md"
      )}
    >
      {/* Card header */}
      <div className={cn("bg-gradient-to-r p-3.5 relative overflow-hidden", colorClass)}>
        <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -translate-y-6 translate-x-6" />
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/25 flex items-center justify-center text-white font-bold text-base">
              {child.name ? child.name.charAt(0).toUpperCase() : (index + 1)}
            </div>
            <input
              value={child.name}
              onChange={(e) => { e.stopPropagation(); onUpdate({ name: e.target.value }) }}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent text-white font-semibold text-sm placeholder:text-white/60 focus:outline-none w-36"
              placeholder={`Çocuk ${index + 1} adı`}
            />
          </div>
          <div className="flex items-center gap-2">
            {child.duration && (
              <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-lg">
                <Clock className="w-3 h-3 text-white" />
                <span className="text-white text-xs font-semibold">
                  {child.duration === "free" ? "Serbest" : `${child.duration}dk`}
                </span>
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-red-500/60 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Duration selector */}
      <div className="bg-white dark:bg-slate-900 p-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Süre Seç</p>
        <div className={cn("grid gap-1.5", activeItems.length <= 4 ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
          {activeItems.map((pkg) => {
            const duration = toDurationOption(pkg.durationMin)
            const isActive = child.duration === duration && child.price === pkg.price
            return (
              <button
                key={pkg.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdate({ duration, price: pkg.price })
                }}
                className={cn(
                  "py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex flex-col items-center gap-0.5",
                  isActive
                    ? `bg-gradient-to-br ${DURATION_COLORS[duration]} text-white shadow-sm`
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                <span>{pkg.label}</span>
                <span className={cn("text-[10px] font-bold", isActive ? "text-white/80" : "text-slate-500")}>
                  ₺{pkg.price}
                </span>
              </button>
            )
          })}
        </div>

        {child.duration && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Ücret</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">₺{child.price}</span>
          </div>
        )}
      </div>
    </div>
  )
}
