"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Users, Baby } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChildEntry, DurationOption } from "@/types/hizli-kayit"
import { useSettingsSection } from "@/lib/settings/settings-store"

// ─── Fast Children Input — operational speed pass ───────────────────────────
//
// Replaces the previous one-card-per-child UI with a single text field that
// turns comma-separated names ("Arda,Elif,Can") into a row of chips. Each
// chip exposes the configured duration packages inline so the staff member
// can assign per-child duration without leaving the keyboard.
//
//   • Type a comma → new chip
//   • Type Enter   → new chip
//   • Backspace on empty input → remove last chip
//   • Click a duration pill → assign price to that child
//
// Talks to the parent via the existing add/update/remove handlers so the
// rest of the registration flow (validation, payments, session create)
// stays untouched.

interface Props {
  kidsList:        ChildEntry[]
  selectedChildId: string | null
  total:           number
  onAdd:           (initialName?: string) => string         // returns new id
  onUpdate:        (id: string, updates: Partial<ChildEntry>) => void
  onRemove:        (id: string) => void
  onSelect:        (id: string) => void
}

function toDurationOption(durationMin: number): DurationOption {
  if (durationMin <= 0)  return "free"
  if (durationMin <= 30) return 30
  if (durationMin <= 60) return 60
  return 90
}

export function FastChildrenInput({
  kidsList, selectedChildId, total,
  onAdd, onUpdate, onRemove, onSelect,
}: Props) {
  const packages = useSettingsSection("packages")
  const activeItems = useMemo(() => packages.items.filter((p) => p.active), [packages])

  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Auto-focus the input on mount so staff can start typing immediately.
  useEffect(() => { inputRef.current?.focus() }, [])

  // Commit a fragment as a new child chip. Skips empties / dupes.
  function commit(raw: string): void {
    const name = raw.trim()
    if (!name) return
    onAdd(name)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "," ) {
      e.preventDefault()
      commit(draft)
      setDraft("")
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      commit(draft)
      setDraft("")
      return
    }
    if (e.key === "Backspace" && draft === "" && kidsList.length > 0) {
      // Remove the last chip on backspace of empty input — matches typical
      // tag-input UX.
      e.preventDefault()
      onRemove(kidsList[kidsList.length - 1].id)
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const raw = e.target.value
    // If the user pastes "Arda,Elif,Can", split on commas and chip them all.
    if (raw.includes(",")) {
      const parts = raw.split(",")
      const tail  = parts.pop() ?? ""        // last part stays in the input
      for (const part of parts) commit(part)
      setDraft(tail)
      return
    }
    setDraft(raw)
  }

  function onBlur(): void {
    // Commit on blur so the operator doesn't lose a trailing name.
    if (draft.trim()) {
      commit(draft)
      setDraft("")
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Çocuklar</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {kidsList.length > 0
              ? `${kidsList.length} çocuk · virgülle ayır`
              : "Çocuk adı yaz, virgülle birden fazla ekle"}
          </p>
        </div>
        {kidsList.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-500/10 rounded-xl">
            <Users className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <span className="text-sm font-bold text-violet-700 dark:text-violet-400">₺{total.toLocaleString("tr-TR")}</span>
          </div>
        )}
      </div>

      {/* Combined input + chips */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "rounded-2xl border-2 transition-all bg-white dark:bg-slate-900 px-3 py-2.5 min-h-[64px]",
          "border-slate-200 dark:border-slate-700 focus-within:border-violet-500 dark:focus-within:border-violet-500",
          kidsList.length > 0 && "space-y-1",
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {kidsList.map((child) => (
            <ChildChip
              key={child.id}
              child={child}
              selected={child.id === selectedChildId}
              onSelect={() => onSelect(child.id)}
              onRemove={() => onRemove(child.id)}
              onRename={(name) => onUpdate(child.id, { name })}
            />
          ))}
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            placeholder={kidsList.length === 0 ? "Arda,Elif,Can" : "Yeni çocuk..."}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none py-1.5"
          />
        </div>
      </div>

      {/* Per-chip duration row */}
      {kidsList.length > 0 ? (
        <div className="flex-1 overflow-y-auto space-y-2.5 min-h-0 pr-0.5">
          {kidsList.map((child) => (
            <div key={child.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{child.name || "—"}</p>
                {child.price > 0 && (
                  <span className="text-sm font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                    ₺{child.price.toLocaleString("tr-TR")}
                  </span>
                )}
              </div>
              <div className={cn(
                "grid gap-1.5",
                activeItems.length <= 4 ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-3",
              )}>
                {activeItems.map((pkg) => {
                  const dur = toDurationOption(pkg.durationMin)
                  const active = child.duration === dur && child.price === pkg.price
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => {
                        onSelect(child.id)
                        onUpdate(child.id, { duration: dur, price: pkg.price })
                      }}
                      className={cn(
                        "rounded-lg py-2 text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 border",
                        active
                          ? "bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-500/25"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-violet-300",
                      )}
                    >
                      <span>{pkg.label}</span>
                      <span className={cn("text-[10px]", active ? "text-white/85" : "text-slate-500")}>
                        ₺{pkg.price.toLocaleString("tr-TR")}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-slate-400">
          <Baby className="w-10 h-10" />
          <p className="text-xs">
            Yukarıdaki kutuya çocukların adlarını yaz.<br/>
            <span className="text-slate-500">Virgül ile birden fazla:</span> <strong>Arda,Elif,Can</strong>
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ChildChip({
  child, selected, onSelect, onRemove, onRename,
}: {
  child: ChildEntry; selected: boolean
  onSelect: () => void; onRemove: () => void; onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(child.name)

  function commit(): void {
    setEditing(false)
    const next = val.trim()
    if (next && next !== child.name) onRename(next)
    else setVal(child.name)
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); setVal(child.name) }}
      className={cn(
        "inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors",
        selected
          ? "bg-violet-600 text-white"
          : child.duration
            ? "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300"
            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200",
      )}
    >
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit() }}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-b border-current outline-none w-24 text-xs"
        />
      ) : (
        <span>{child.name || "—"}</span>
      )}
      {child.duration && (
        <span className={cn(
          "text-[10px] font-bold px-1.5 rounded",
          selected ? "bg-white/25" : "bg-white/60 dark:bg-slate-900/60",
        )}>
          {child.duration === "free" ? "∞" : `${child.duration}dk`}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className={cn(
          "w-5 h-5 rounded-md flex items-center justify-center",
          selected ? "hover:bg-white/15" : "hover:bg-rose-500/15 hover:text-rose-600",
        )}
        aria-label={`${child.name} sil`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
