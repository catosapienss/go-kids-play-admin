"use client"

import { useEffect, useRef } from "react"
import { Search, X, Phone, Baby, Loader2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCustomerSearch } from "@/hooks/use-customer-search"
import { type CustomerSummary } from "@/types/customer"
import { LoyaltyBadge } from "./loyalty-badge"
import { TagPills } from "./tag-pills"

// ─── CustomerSearchPalette ────────────────────────────────────────────────────
//
// A focused search experience used by `/crm` and the customer-picker modals.
// Operates exactly like a command palette: type → instant results, ↑↓ to
// navigate, Enter to select, Esc to clear.
//
// • Empty query → recents (last 8 visited)
// • ≥ 2 chars   → debounced server search
// • Touch-friendly: ≥ 56 px row height

interface Props {
  onSelect: (customer: CustomerSummary) => void
  autoFocus?: boolean
  initialQuery?: string
  /** When provided, the input field is omitted and `query` is controlled externally. */
  externalQuery?: string
  className?: string
}

function fmtPhone(p: string): string {
  if (!p) return ""
  const digits = p.replace(/\D/g, "")
  if (digits.length === 11) return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7,9)} ${digits.slice(9)}`
  return p
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return "bugün"
  if (d === 1) return "dün"
  if (d < 7)   return `${d} gün`
  if (d < 30)  return `${Math.floor(d/7)} hafta`
  if (d < 365) return `${Math.floor(d/30)} ay`
  return `${Math.floor(d/365)} yıl`
}

export function CustomerSearchPalette({ onSelect, autoFocus, initialQuery, externalQuery, className }: Props) {
  const { query, setQuery, results, isRecents, isLoading, error } = useCustomerSearch({
    initialQuery: externalQuery ?? initialQuery,
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Keep query in sync with externalQuery when controlled.
  useEffect(() => {
    if (externalQuery !== undefined) setQuery(externalQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuery])

  return (
    <div className={cn("rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col", className)}>
      {externalQuery === undefined && (
        <div className="relative border-b border-slate-100 dark:border-slate-800">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="İsim, telefon veya çocuk adıyla ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3.5 text-base bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Temizle"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {isLoading && (
            <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-violet-500" />
          )}
        </div>
      )}

      {/* Header strip */}
      <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
        {isRecents ? <Clock className="w-2.5 h-2.5" /> : <Search className="w-2.5 h-2.5" />}
        <span>{isRecents ? "Son ziyaretçiler" : `${results.length} sonuç`}</span>
        {error && <span className="ml-auto text-rose-600 dark:text-rose-400 normal-case tracking-normal">{error}</span>}
      </div>

      {/* Result list */}
      <div className="flex-1 overflow-y-auto min-h-[200px]">
        {results.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Search className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Sonuç bulunamadı</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              İsim, telefon ya da çocuk adıyla deneyin
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/60 transition-colors min-h-[56px]"
                >
                  {/* Avatar */}
                  <div className={cn(
                    "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold flex-shrink-0",
                    c.isVip
                      ? "from-amber-400 to-orange-500"
                      : "from-violet-500 to-purple-600",
                  )}>
                    {c.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "?"}
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.fullName}</p>
                      <LoyaltyBadge customer={c} size="sm" showLabel={false} />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />
                        {fmtPhone(c.phone)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Baby className="w-2.5 h-2.5" />
                        {c.childCount} çocuk
                      </span>
                    </div>
                    {c.tags.length > 0 && (
                      <div className="mt-1">
                        <TagPills parentId={c.id} tags={c.tags} readOnly />
                      </div>
                    )}
                  </div>

                  {/* Stats column */}
                  <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">Son</span>
                    <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                      {fmtRelative(c.lastVisitAt)}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {c.visitCount} ziyaret · ₺{c.totalSpent.toLocaleString("tr-TR")}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
