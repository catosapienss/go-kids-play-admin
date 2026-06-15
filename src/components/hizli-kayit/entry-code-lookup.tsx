"use client"

import { useEffect, useRef, useState } from "react"
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  lookupEntryCode, normalizeCode, isPlausibleCode,
  type LookupResult,
} from "@/lib/services/entry-code.service"
import { toast } from "sonner"

// ─── EntryCodeLookup ──────────────────────────────────────────────────────────
//
// Primary "find customer" input for the Hızlı Kayıt screen during the
// manual-code era. Cashier types `PLAY-1234` → parent + children load
// instantly via `lookup_entry_code` RPC.
//
// Forwards the resolved data to the parent screen through `onResolved`. The
// parent screen then populates its CustomerPanel / ChildrenPanel as if the
// customer had been picked from a search list.
//
// Touch-friendly (≥ 44 px tap target), works alongside the existing
// name/phone search box.

interface Props {
  onResolved: (result: Extract<LookupResult, { ok: true }>) => void
  /** Autofocus the input on mount — useful when this is the first thing on the screen. */
  autoFocus?: boolean
  className?: string
}

export function EntryCodeLookup({ onResolved, autoFocus, className }: Props) {
  const [raw, setRaw] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Live-format what the operator types so they see "PLAY-1234" even if they
  // type "play1234" without a dash.
  const displayValue = raw === "" ? "" : normalizeCode(raw)

  async function submit() {
    if (busy) return
    if (!isPlausibleCode(displayValue)) {
      setError("Kod formatı: PLAY-1234, GKP-1234 veya KID-1234")
      return
    }
    setBusy(true)
    setError(null)
    setOk(false)
    try {
      const r = await lookupEntryCode(displayValue)
      if (!r.ok) {
        const messages: Record<typeof r.reason, string> = {
          not_found: "Bu kod sistemde kayıtlı değil.",
          revoked:   "Bu kod artık geçerli değil.",
          expired:   "Bu kodun süresi dolmuş.",
        }
        setError(messages[r.reason])
        return
      }
      setOk(true)
      toast.success(`${r.parent.full_name} bulundu`, {
        description: `${r.children.length} çocuk · ${r.code}`,
      })
      onResolved(r)
      // Reset after a brief success flash so the next operator can use it immediately.
      setTimeout(() => { setRaw(""); setOk(false) }, 800)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Kod arama başarısız"
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void submit()
    }
  }

  const showHint = !raw && !error && !ok

  return (
    <div className={cn(
      "rounded-2xl border bg-white dark:bg-slate-900 transition-colors",
      ok
        ? "border-emerald-300 dark:border-emerald-600/60"
        : error
        ? "border-rose-300 dark:border-rose-600/60"
        : "border-slate-200 dark:border-slate-800",
      className,
    )}>
      <div className="flex items-stretch">
        {/* Icon column */}
        <div className={cn(
          "flex items-center justify-center px-4 border-r",
          ok
            ? "border-emerald-200/70 dark:border-emerald-700/40 bg-emerald-50/60 dark:bg-emerald-500/[0.08]"
            : error
            ? "border-rose-200/70 dark:border-rose-700/40 bg-rose-50/60 dark:bg-rose-500/[0.08]"
            : "border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40",
        )}>
          {busy
            ? <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
            : ok
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            : <KeyRound className={cn("w-4 h-4", error ? "text-rose-500" : "text-violet-500")} />}
        </div>

        {/* Input column */}
        <div className="flex-1 min-w-0 px-4 py-3">
          <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-0.5">
            Müşteri Kodu
          </label>
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            value={displayValue}
            placeholder="PLAY-1234"
            onChange={(e) => { setRaw(e.target.value); setError(null); setOk(false) }}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent border-0 outline-none text-base font-mono font-bold tracking-wider text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal"
          />
        </div>

        {/* Action */}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !displayValue}
          className={cn(
            "px-4 sm:px-5 min-h-[44px] font-bold text-sm transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            ok
              ? "bg-emerald-500 text-white"
              : "bg-violet-600 hover:bg-violet-700 text-white",
          )}
        >
          {busy ? "..." : ok ? "✓" : "Ara"}
        </button>
      </div>

      {/* Footer line */}
      <div className={cn(
        "px-4 py-2 border-t text-[11px]",
        error
          ? "border-rose-200/70 dark:border-rose-700/40 text-rose-700 dark:text-rose-300"
          : "border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400",
      )}>
        {error ? (
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" />
            {error}
          </span>
        ) : showHint ? (
          <span>Veliyi koduyla saniyeler içinde bul · isimle arama hâlâ aşağıda</span>
        ) : (
          <span className="opacity-0">·</span>  /* keep height stable */
        )}
      </div>
    </div>
  )
}
