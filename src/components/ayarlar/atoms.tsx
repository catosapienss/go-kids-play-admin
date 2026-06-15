"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Form atoms — production-polished, touch-friendly ────────────────────────

export function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

export function FieldGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 mb-6 last:mb-0">
      {title && (
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">
          {title}
        </p>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  )
}

interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
  /** Compact = inline layout (label left, control right). Default = stacked. */
  inline?: boolean
}

export function Field({ label, hint, children, inline }: FieldProps) {
  if (inline) {
    return (
      <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
          {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
        </div>
        <div className="flex-shrink-0">{children}</div>
      </div>
    )
  }
  return (
    <div>
      <label className="block">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</p>
        {children}
      </label>
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

// ─── Text input ──────────────────────────────────────────────────────────────

export function TextInput({
  value, onChange, placeholder, disabled, className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700",
        "bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white",
        "outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20",
        "transition-colors",
        className,
      )}
    />
  )
}

// ─── Number input (with unit suffix) ─────────────────────────────────────────

export function NumberInput({
  value, onChange, min = 0, max, step = 1, suffix, disabled, className,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn("relative w-32", className)}>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        className={cn(
          "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700",
          "bg-white dark:bg-slate-900 text-sm font-bold tabular-nums text-right text-slate-900 dark:text-white",
          "outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20",
          suffix && "pr-9",
        )}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  )
}

// ─── Toggle switch ───────────────────────────────────────────────────────────

export function Toggle({
  checked, onChange, disabled, label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors flex-shrink-0",
        checked
          ? "bg-violet-600"
          : "bg-slate-300 dark:bg-slate-700",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  )
}

// ─── Segmented picker (small enums) ──────────────────────────────────────────

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors min-h-[32px]",
            value === opt.value
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Save bar ────────────────────────────────────────────────────────────────

export function SaveBar({
  saved, onReset,
}: {
  saved: boolean
  onReset?: () => void
}) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-8 px-6 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs">
        <Check className={cn(
          "w-3.5 h-3.5 transition-opacity",
          saved ? "text-emerald-500 opacity-100" : "opacity-0",
        )} />
        <span className={cn(
          "font-semibold transition-colors",
          saved ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400",
        )}>
          {saved ? "Otomatik kaydedildi" : "Değişiklikler anında kaydedilir"}
        </span>
      </div>
      {onReset && (
        <button
          type="button"
          onClick={() => { if (confirm("Bu bölümün ayarları varsayılana sıfırlansın mı?")) onReset() }}
          className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
        >
          Sıfırla
        </button>
      )}
    </div>
  )
}

// ─── Saved toast bridge (returns helper to trigger ephemeral "saved" state) ─

export function useSavedFlag(): [boolean, () => void] {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [saved, setSaved] = useStateLite(false)
  const flag = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  return [saved, flag]
}

// Tiny shim so the hook above doesn't pull `react` import here every time.
import { useState } from "react"
function useStateLite<T>(initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial)
  return [v, setV]
}
