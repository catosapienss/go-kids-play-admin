"use client"

import {
  Baby, CreditCard, Wallet, Clock, AlertTriangle, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type CustomerActivityEvent, type ActivityKind } from "@/types/customer"

// ─── CustomerActivityTimeline ────────────────────────────────────────────────
//
// Renders a single parent's activity feed (sessions, payments, wallets,
// extensions, refunds) as a vertical timeline with a left rail.

interface Props {
  events: CustomerActivityEvent[]
  className?: string
}

const KIND_META: Record<ActivityKind, { icon: LucideIcon; bg: string; fg: string; label: string }> = {
  session_start: { icon: Baby,           bg: "bg-violet-500/10",  fg: "text-violet-700 dark:text-violet-300",  label: "Oturum başladı" },
  payment:       { icon: CreditCard,     bg: "bg-emerald-500/10", fg: "text-emerald-700 dark:text-emerald-300", label: "Ödeme alındı" },
  wallet:        { icon: Wallet,         bg: "bg-blue-500/10",    fg: "text-blue-700 dark:text-blue-300",      label: "Cüzdan işlemi" },
  extension:     { icon: Clock,          bg: "bg-amber-500/10",   fg: "text-amber-700 dark:text-amber-300",    label: "Süre uzatma" },
  refund:        { icon: AlertTriangle,  bg: "bg-rose-500/10",    fg: "text-rose-700 dark:text-rose-300",      label: "İade" },
}

function fmtMoney(n: unknown): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return ""
  return `₺${v.toLocaleString("tr-TR")}`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    })
  } catch { return iso }
}

function describe(e: CustomerActivityEvent): string {
  const m = e.meta ?? {}
  switch (e.kind) {
    case "session_start":
      return `${m.child_name ?? "Çocuk"} · ${m.duration_minutes === 0 ? "Sınırsız" : `${m.duration_minutes} dk`} paket`
    case "payment": {
      const parts: string[] = []
      if (Number(m.cash_amount)   > 0) parts.push(`Nakit ${fmtMoney(m.cash_amount)}`)
      if (Number(m.card_amount)   > 0) parts.push(`Kart ${fmtMoney(m.card_amount)}`)
      if (Number(m.wallet_amount) > 0) parts.push(`Cüzdan ${fmtMoney(m.wallet_amount)}`)
      return parts.join(" · ") || fmtMoney(m.total_amount)
    }
    case "wallet": {
      const sign = m.type === "load" ? "+" : "−"
      const label = m.type === "load" ? "Yükleme" : m.type === "refund" ? "İade kredisi" : m.type === "use" ? "Kullanım" : "Bonus"
      return `${label} · ${sign}${fmtMoney(m.amount)}${m.method ? ` (${m.method === "cash" ? "Nakit" : "Kart"})` : ""}`
    }
    case "extension":
      return `+${m.added_minutes ?? 0} dk · ${fmtMoney(m.amount)}`
    case "refund":
      return `${fmtMoney(m.amount)} · ${m.reason ?? "—"}`
  }
}

export function CustomerActivityTimeline({ events, className }: Props) {
  if (events.length === 0) {
    return (
      <div className={cn("text-center py-10 text-sm text-slate-500 dark:text-slate-400", className)}>
        Bu müşteri için henüz aktivite kaydı yok.
      </div>
    )
  }

  return (
    <ol className={cn("relative", className)}>
      <div className="absolute left-[15px] top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-800" aria-hidden />
      {events.map((e) => {
        const meta = KIND_META[e.kind]
        const Icon = meta.icon
        const moneyValue = e.kind === "payment"
          ? Number(e.meta.total_amount)
          : e.kind === "extension"
          ? Number(e.meta.amount)
          : e.kind === "refund"
          ? Number(e.meta.amount)
          : null
        return (
          <li key={e.id} className="relative pl-10 pb-4 last:pb-0">
            <div className={cn(
              "absolute left-0 top-0.5 w-8 h-8 rounded-xl flex items-center justify-center ring-4 ring-white dark:ring-slate-900",
              meta.bg,
            )}>
              <Icon className={cn("w-4 h-4", meta.fg)} />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("text-[11px] uppercase tracking-wider font-bold", meta.fg)}>
                {meta.label}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                {fmtDate(e.occurredAt)}
              </span>
            </div>
            <p className="text-sm text-slate-800 dark:text-slate-100 mt-0.5">
              {describe(e)}
            </p>
            {Number.isFinite(moneyValue) && moneyValue !== 0 && (
              <p className={cn(
                "text-sm font-bold tabular-nums mt-0.5",
                e.kind === "refund" ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200",
              )}>
                {e.kind === "refund" ? "−" : ""}{fmtMoney(moneyValue)}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
