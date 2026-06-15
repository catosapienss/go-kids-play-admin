"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Organization } from "@/types/organizasyon"

interface MiniCalendarProps {
  organizations: Organization[]
  onSelectDate?: (date: string) => void
  selectedDate?: string
}

const DAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"]
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

export function MiniCalendar({ organizations, onSelectDate, selectedDate }: MiniCalendarProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const orgDates = new Set(organizations.map((o) => o.date))
  const ongoingDates = new Set(organizations.filter((o) => o.status === "ongoing").map((o) => o.date))
  const upcomingDates = new Set(organizations.filter((o) => o.status === "upcoming").map((o) => o.date))

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  const firstDay = new Date(viewYear, viewMonth, 1)
  // Monday-based: shift so Mon=0
  const startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  function dateStr(day: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
          <ChevronLeft className="w-4 h-4 text-slate-500" />
        </button>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {MONTHS[viewMonth]} {viewYear}
        </p>
        <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />
          const ds = dateStr(day)
          const hasOrg = orgDates.has(ds)
          const isOngoing = ongoingDates.has(ds)
          const isUpcoming = upcomingDates.has(ds)
          const isSelected = selectedDate === ds
          const todayCell = isToday(day)

          return (
            <button
              key={idx}
              onClick={() => hasOrg && onSelectDate?.(ds)}
              className={cn(
                "relative aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all",
                todayCell && !isSelected && "ring-2 ring-violet-500 ring-offset-1",
                isSelected && "bg-violet-600 text-white",
                !isSelected && todayCell && "text-violet-700 dark:text-violet-400 font-bold",
                !isSelected && !todayCell && "text-slate-700 dark:text-slate-300",
                hasOrg && !isSelected && "hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer",
                !hasOrg && "cursor-default"
              )}
            >
              {day}
              {hasOrg && !isSelected && (
                <span className={cn(
                  "absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                  isOngoing ? "bg-emerald-500" : isUpcoming ? "bg-sky-500" : "bg-slate-400"
                )} />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Devam ediyor
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          Yaklaşıyor
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          Tamamlandı
        </div>
      </div>
    </div>
  )
}
