"use client"

import { useEffect, useRef, useState } from "react"
import { Building2, Check, ChevronsUpDown, Globe2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBranch } from "@/lib/branch/branch-context"

// ─── Branch Switcher ──────────────────────────────────────────────────────────
//
// Visible only to users who can switch branches (super_admin).
// Other roles see a static branch label (or nothing on tight headers).

export function BranchSwitcher() {
  const { branches, activeBranch, canSwitch, setActiveBranch, isLoading } = useBranch()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Pinned role: minimal static label.
  if (!canSwitch) {
    if (!activeBranch) return null
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
        <Building2 className="w-3.5 h-3.5 text-slate-500" />
        <span className="font-semibold text-slate-700 dark:text-slate-200">{activeBranch.branchName}</span>
        <span className="text-[10px] text-slate-400">·</span>
        <span className="text-[10px] font-medium text-slate-500">{activeBranch.branchCode}</span>
      </div>
    )
  }

  const label = activeBranch ? activeBranch.branchName : "Tüm Şubeler"
  const code  = activeBranch ? activeBranch.branchCode : "GLOBAL"

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl",
          "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700",
          "text-xs transition-colors",
        )}
      >
        {activeBranch
          ? <Building2 className="w-3.5 h-3.5 text-violet-500" />
          : <Globe2 className="w-3.5 h-3.5 text-fuchsia-500" />}
        <div className="flex flex-col items-start leading-tight">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{label}</span>
          <span className="text-[10px] text-slate-400">{code}</span>
        </div>
        <ChevronsUpDown className="w-3 h-3 text-slate-400 ml-1" />
      </button>

      {open && (
        <div className={cn(
          "absolute right-0 top-11 z-50 w-[260px]",
          "rounded-xl border border-slate-200 dark:border-slate-800",
          "bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/10 dark:shadow-black/30",
          "overflow-hidden animate-[fadeInDown_140ms_ease-out]",
        )}>
          <div className="px-3 pt-3 pb-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
            Şube seçimi
          </div>

          {/* All-branches option (super-admin only) */}
          <BranchRow
            label="Tüm Şubeler"
            code="GLOBAL"
            isAll
            selected={!activeBranch}
            onClick={() => { setActiveBranch(null); setOpen(false) }}
          />

          <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2 my-1" />

          {isLoading ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400">Yükleniyor…</div>
          ) : branches.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400">Hiç şube yok.</div>
          ) : (
            <div className="max-h-[260px] overflow-y-auto py-1">
              {branches.map((b) => (
                <BranchRow
                  key={b.id}
                  label={b.branchName}
                  code={b.branchCode}
                  selected={activeBranch?.id === b.id}
                  onClick={() => { setActiveBranch(b.id); setOpen(false) }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

interface RowProps {
  label: string
  code: string
  isAll?: boolean
  selected: boolean
  onClick: () => void
}

function BranchRow({ label, code, isAll, selected, onClick }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 text-left",
        "hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors",
        selected && "bg-violet-50/60 dark:bg-violet-500/[0.08]",
      )}
    >
      <div className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
        isAll
          ? "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300"
          : "bg-violet-500/10 text-violet-600 dark:text-violet-300",
      )}>
        {isAll ? <Globe2 className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{label}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400">{code}</p>
      </div>
      {selected && <Check className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />}
    </button>
  )
}
