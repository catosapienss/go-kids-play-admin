"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Plus, RotateCcw } from "lucide-react"

// ─── Cash Count Input ─────────────────────────────────────────────────────────
//
// Touch-first numeric entry for kasa kapanış. Three input modes co-exist:
//
//   1. Tap the field → soft on-screen keypad with full keyboard fallback
//   2. "Quick add" pills: +100, +50, +20, +10 → operator stacks bill counts
//   3. Direct keyboard input — operator can still type if they prefer
//
// Built to be calm under stress: no auto-focus jumps, no value coercion that
// might surprise the operator, +/- always reversible, large hit areas.

interface CashCountInputProps {
  label: string
  value: number
  onChange: (next: number) => void
  /** Optional expected amount — shown for reference, never auto-fills. */
  expected?: number
  /** Single-method tone (cash green / card blue / wallet violet). */
  tone?: "emerald" | "blue" | "violet"
  /** Optional Lucide icon for the row. */
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
  className?: string
}

const QUICK_ADDS = [100, 50, 20, 10] as const

const TONES = {
  emerald: { border: "border-emerald-200 dark:border-emerald-700/40", focus: "focus-within:border-emerald-400 dark:focus-within:border-emerald-500", iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15" },
  blue:    { border: "border-blue-200 dark:border-blue-700/40",       focus: "focus-within:border-blue-400 dark:focus-within:border-blue-500",       iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",       chip: "bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15" },
  violet:  { border: "border-violet-200 dark:border-violet-700/40",   focus: "focus-within:border-violet-400 dark:focus-within:border-violet-500",   iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",   chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/15" },
}

function fmt(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function CashCountInput({
  label, value, onChange, expected, tone = "emerald", icon: Icon, disabled, className,
}: CashCountInputProps) {
  const t = TONES[tone]
  const [text, setText] = useState<string>(String(value || 0))
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external value changes (e.g. quick-add buttons modifying value).
  useEffect(() => {
    // Only re-sync from prop when the parsed value diverges from the visible text.
    // This prevents "8" → "80" when operator is mid-typing.
    const parsed = Number(text)
    if (Number.isFinite(parsed) && parsed !== value) {
      setText(String(value || 0))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function commit(next: number) {
    const safe = Number.isFinite(next) && next >= 0 ? next : 0
    setText(String(safe))
    onChange(safe)
  }

  function handleTextChange(raw: string) {
    // Allow only digits + a single dot/comma (which we'll normalise).
    const cleaned = raw.replace(",", ".").replace(/[^0-9.]/g, "")
    setText(cleaned)
    const parsed = Number(cleaned)
    onChange(Number.isFinite(parsed) ? parsed : 0)
  }

  function addQuick(delta: number) {
    commit((Number(text) || 0) + delta)
  }
  function resetToZero() {
    commit(0)
  }

  const diff = expected !== undefined ? value - expected : null

  return (
    <div className={cn(
      "rounded-2xl border-2 bg-white dark:bg-slate-900 transition-colors p-3",
      t.border, t.focus,
      disabled && "opacity-50 pointer-events-none",
      className,
    )}>
      <div className="flex items-center gap-3">
        {/* Icon + label */}
        <div className="flex items-center gap-2 min-w-[100px]">
          {Icon && (
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", t.iconBg)}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
              {label}
            </p>
            {expected !== undefined && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                Bekl: ₺{fmt(expected)}
              </p>
            )}
          </div>
        </div>

        {/* Value + ₺ */}
        <div className="flex-1 flex items-baseline gap-1 justify-end">
          <span className="text-base font-bold text-slate-400 dark:text-slate-500">₺</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={(e) => commit(Number(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            className="bg-transparent border-0 outline-none text-right text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white w-32 sm:w-40 placeholder:text-slate-300"
            placeholder="0"
          />
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={resetToZero}
          disabled={disabled}
          title="Sıfırla"
          aria-label="Sıfırla"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick-add pills + diff badge */}
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Hızlı ekle:</span>
        {QUICK_ADDS.map((amt) => (
          <button
            key={amt}
            type="button"
            disabled={disabled}
            onClick={() => addQuick(amt)}
            className={cn(
              "flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-bold transition-colors min-h-[28px]",
              t.chip,
            )}
          >
            <Plus className="w-2.5 h-2.5" />
            {amt}
          </button>
        ))}
        {diff !== null && Math.abs(diff) >= 0.005 && (
          <span className={cn(
            "ml-auto text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums",
            diff > 0
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
          )}>
            {diff > 0 ? "+" : ""}₺{fmt(diff)}
          </span>
        )}
        {diff !== null && Math.abs(diff) < 0.005 && value > 0 && (
          <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            ✓ Tutuyor
          </span>
        )}
      </div>
    </div>
  )
}
