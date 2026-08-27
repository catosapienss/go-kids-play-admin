"use client"

import { Ticket, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Membership } from "@/types/membership"

// ─── Personal Access Banner (Hızlı Kayıt) ────────────────────────────────────
//
// For the selected child, surfaces any active customer-specific personal
// access entitlements (punch passes) and lets staff start a ₺0 visit on the
// exact one they choose — e.g. "20 Günlük Erişim — 12 kalan" vs "14 Günlük
// Erişim — 3 kalan". Never silently consumes: staff must tap the specific
// entitlement. Purely additive — renders nothing when the child has none.

interface Props {
  entitlements: Membership[]
  /** Currently-selected entitlement id for this child (₺0 visit), if any. */
  selectedId?: string
  onSelect: (m: Membership | null) => void
}

export function PersonalAccessBanner({ entitlements, selectedId, onSelect }: Props) {
  if (!entitlements || entitlements.length === 0) return null

  return (
    <div className="rounded-2xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/60 dark:bg-teal-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-300 flex items-center justify-center">
          <Ticket className="w-4 h-4" />
        </div>
        <p className="text-sm font-black text-slate-900 dark:text-white">Kişisel Erişim Hakkı</p>
      </div>

      <div className="space-y-1.5">
        {entitlements.map((m) => {
          const active = selectedId === m.id
          const remaining = m.remainingUses ?? 0
          const name = m.label || "Kişisel Erişim"
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(active ? null : m)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 text-left transition-colors",
                active
                  ? "border-teal-500 bg-teal-100/70 dark:bg-teal-900/40"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-teal-300",
              )}
            >
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                active ? "bg-teal-600 text-white" : "border-2 border-slate-300 dark:border-slate-600",
              )}>
                {active && <Check className="w-3 h-3" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">{name}</span>
                <span className={cn(
                  "block text-[11px] font-semibold",
                  remaining <= 3 ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-300",
                )}>
                  {remaining} gün kaldı
                  <span className="text-slate-400 font-normal"> / {m.totalUses ?? 0}</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {selectedId && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
        >
          <X className="w-3.5 h-3.5" /> Kişisel hakkı kaldır
        </button>
      )}

      <p className="text-[10px] text-slate-400">
        Seçilen hak ₺0 giriş oluşturur ve 1 gün kullanım düşer.
      </p>
    </div>
  )
}
