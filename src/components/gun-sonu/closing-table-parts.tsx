"use client"

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Shared table primitives for the two day-end history sections ────────────
//
// Deliberately unstyled/neutral: `Geçmiş Kapanışlar` and `Personel Kapanışları`
// each own their own chrome, columns and accent colour — these are only the
// mechanical bits (search field, pager) so the two sections stay in sync on
// behaviour while staying visually independent.

export function SearchBox({ value, onChange, placeholder, accent }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  accent: string
}) {
  return (
    <div className="relative flex-1 min-w-[180px]">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-slate-700",
          "bg-white dark:bg-slate-900 text-[12px] text-slate-900 dark:text-white",
          "outline-none focus:ring-2 focus:border-transparent",
          accent,
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Aramayı temizle"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

export function FilterChips<T extends string>({ options, value, onChange, activeClass }: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  activeClass: string
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900/60">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 h-8 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap",
            value === o.value
              ? activeClass
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Pager({ page, pageCount, total, from, to, onPage }: {
  page: number
  pageCount: number
  total: number
  from: number
  to: number
  onPage: (p: number) => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
        {from}–{to} / {total} kayıt
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Önceki sayfa"
          className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          aria-label="Sonraki sayfa"
          className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
