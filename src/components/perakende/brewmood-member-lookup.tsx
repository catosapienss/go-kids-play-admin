"use client"

import { useRef, useState } from "react"
import { KeyRound, Loader2, Coffee, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  lookupEntryCode, normalizeCode, isPlausibleCode,
} from "@/lib/services/entry-code.service"
import { getMembershipStatusForChild } from "@/lib/services/membership.service"

// ─── Brew Mood Member Lookup (Perakende / coffee counter) ────────────────────
//
// The retail POS is otherwise anonymous. Here the cashier types the customer's
// entry code (the same PLAY-1234 printed on their play label). We resolve the
// parent's children and check whether any of them holds an ACTIVE monthly
// membership — if so the parent earns the Brew Mood coffee discount, which the
// cashier can then apply to the beverage lines with one tap.
//
// Read-only: reuses `lookup_entry_code` + `membership_status_for_child`. No new
// RPC, no writes until the cashier applies the discount at checkout.

export interface BrewmoodMember {
  code:        string
  parentName:  string
  packageName: string
  pct:         number
}

interface Props {
  onVerified: (member: BrewmoodMember) => void
}

export function BrewmoodMemberLookup({ onVerified }: Props) {
  const [raw, setRaw]     = useState("")
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayValue = raw === "" ? "" : normalizeCode(raw)

  async function verify() {
    if (busy) return
    if (!isPlausibleCode(displayValue)) {
      setError("Kod formatı: PLAY-1234, GKP-1234 veya KID-1234")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await lookupEntryCode(displayValue)
      if (!r.ok) {
        setError(r.reason === "not_found" ? "Bu kod sistemde kayıtlı değil." : "Kod geçersiz.")
        return
      }
      // Any child with an active membership → the parent has the benefit.
      let pct = 0
      let packageName = ""
      for (const c of r.children) {
        const st = await getMembershipStatusForChild(c.id)
        if (st.hasMembership && (st.brewmoodDiscountPct ?? 0) > 0) {
          pct = st.brewmoodDiscountPct ?? 0
          packageName = st.packageName || "Aylık Üyelik"
          break
        }
      }
      if (pct <= 0) {
        setError("Bu müşterinin aktif aylık üyeliği yok.")
        return
      }
      onVerified({ code: r.code, parentName: r.parent.full_name, packageName, pct })
      setRaw("")
      toast.success(`Brew Mood %${pct} indirim hakkı doğrulandı`)
    } catch {
      setError("Sorgulanamadı — tekrar deneyin.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.06] p-3 mb-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300 mb-2">
        <Coffee className="w-3.5 h-3.5" />
        Brew Mood Üyelik İndirimi
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            value={displayValue}
            onChange={(e) => { setRaw(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === "Enter") void verify() }}
            placeholder="Müşteri kodu (PLAY-1234)"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:font-sans"
          />
        </div>
        <button
          type="button"
          onClick={() => void verify()}
          disabled={busy}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-bold text-white inline-flex items-center gap-1.5 transition-colors",
            busy ? "bg-amber-400 cursor-wait" : "bg-amber-600 hover:bg-amber-500",
          )}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coffee className="w-4 h-4" />}
          Sorgula
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
      <p className="mt-2 text-[11px] text-amber-700/70 dark:text-amber-300/60 leading-snug">
        Müşterinin oyun etiketindeki kodu girin — aktif aylık üyelik varsa kahve indirimi uygulanabilir.
      </p>
    </div>
  )
}
