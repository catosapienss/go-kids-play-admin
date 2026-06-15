"use client"

import { Search, Download, Calendar, SlidersHorizontal } from "lucide-react"

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  filter: string
  onFilterChange: (v: string) => void
}

const FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "payment", label: "Ödeme" },
  { value: "wallet_load", label: "Yükleme" },
  { value: "wallet_use", label: "Cüzdan" },
  { value: "refund", label: "İade" },
  { value: "split", label: "Karma" },
]

export function FilterBar({ search, onSearchChange, filter, onFilterChange }: FilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Müşteri veya işlem ara..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>

        {/* Date picker placeholder */}
        <button className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap">
          <Calendar className="w-4 h-4" />
          <span className="hidden sm:inline">11 May 2026</span>
        </button>

        {/* Filter */}
        <button className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filtre</span>
        </button>

        {/* Export */}
        <button className="flex items-center gap-2 px-3 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
              filter === f.value
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
