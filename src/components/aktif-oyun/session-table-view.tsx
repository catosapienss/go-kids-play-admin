"use client"

import { useMemo } from "react"
import { Plus, LogOut, Crown, Pause, Play, Banknote, CreditCard, Wallet, AlertCircle, Clock, StickyNote } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActiveSession } from "@/types/aktif-oyun"
import { getStatus, formatTime } from "@/types/aktif-oyun"
import { ReprintLabelsButton } from "./reprint-labels-button"
import { useSessionPayments, type DerivedMethod } from "./use-session-payments"

// ─── Session Table View ─────────────────────────────────────────────────────
//
// One-screen operational layout. Every column the floor staff need is
// visible without expanding a card or opening a detail page:
//
//   Çocuk · Veli · Telefon · Giriş · Çıkış · Kalan · Süre · Fiyat · Ödeme · Aksiyonlar
//
// Each row offers inline Süre Uzat / Çıkış / Etiket buttons.
//
// Read-only with respect to operational data. Price + payment method are
// derived from existing public.payments rows; the hook performs a single
// batched select against PostgREST, no inserts/updates ever.

interface Props {
  sessions:       ActiveSession[]
  onExtend:       (id: string) => void
  onTimeExpired:  (id: string) => void
  onManualExit:   (id: string) => void
  onPause:        (id: string) => void
  onResume:       (id: string) => void
}

const METHOD_META: Record<DerivedMethod, { label: string; icon?: typeof Banknote; cls: string }> = {
  cash:   { label: "Nakit",     icon: Banknote,   cls: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  card:   { label: "Kart",      icon: CreditCard, cls: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  wallet: { label: "Cüzdan",    icon: Wallet,     cls: "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  mixed:  { label: "Karma",                       cls: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  free:   { label: "Ücretsiz",                    cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
  none:   { label: "—",                            cls: "bg-slate-100 dark:bg-slate-800 text-slate-400" },
}

const STATUS_DOT: Record<ReturnType<typeof getStatus>, string> = {
  active:   "bg-emerald-500",
  paused:   "bg-amber-500",
  expiring: "bg-amber-500 animate-pulse",
  expired:  "bg-rose-600 animate-ping",
}

function fmt(n: number): string {
  return "₺" + Math.round(n).toLocaleString("tr-TR")
}

function durationLabel(s: ActiveSession): string {
  if (s.packageType === "Serbest" || s.totalMinutes === 0) return "Sınırsız"
  return `${s.totalMinutes} dk`
}

function exitTimeLabel(s: ActiveSession): string {
  if (s.packageType === "Serbest" || s.totalMinutes === 0) return "Sınırsız"
  if (s.remainingSeconds <= 0) return "Doldu"
  const end = new Date(Date.now() + s.remainingSeconds * 1000)
  return `${pad(end.getHours())}:${pad(end.getMinutes())}`
}

function remainingLabel(s: ActiveSession): string {
  if (s.isPaused)                                            return "Duraklı"
  if (s.packageType === "Serbest" || s.totalMinutes === 0)   return "∞"
  if (s.remainingSeconds <= 0)                               return "SÜRESİ BİTTİ"
  return formatTime(s.remainingSeconds)
}

function pad(n: number): string { return n < 10 ? "0" + n : String(n) }

export function SessionTableView({ sessions, onExtend, onTimeExpired, onManualExit, onPause, onResume }: Props) {
  const ids = useMemo(() => sessions.map((s) => s.id), [sessions])
  const payments = useSessionPayments(ids)

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Th className="w-12">#</Th>
              <Th>Çocuk</Th>
              <Th>Veli</Th>
              <Th>Telefon</Th>
              <Th>Giriş</Th>
              <Th>Çıkış</Th>
              <Th className="text-right">Kalan</Th>
              <Th>Paket</Th>
              <Th className="text-right">Fiyat</Th>
              <Th>Ödeme</Th>
              <Th className="text-right pr-4">Aksiyon</Th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-12 text-sm text-slate-400">
                  Aktif oturum yok
                </td>
              </tr>
            ) : sessions.map((s, idx) => {
              const status = getStatus(s)
              const meta   = METHOD_META[payments[s.id]?.method ?? "none"]
              const total  = payments[s.id]?.total ?? 0
              const MIcon  = meta.icon
              return (
                <tr
                  key={s.id}
                  className={cn(
                    "border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors",
                    status === "expiring" && "bg-amber-50/60 dark:bg-amber-500/[0.05]",
                    status === "expired"  && "bg-rose-100/70 dark:bg-rose-500/[0.12] font-semibold",
                  )}
                >
                  <td className="px-3 py-2.5 text-[11px] font-mono">
                    {/* Atomic daily entry number (migration 020) — the same
                        number printed on the child's label. Falls back to the
                        row position for pre-migration sessions. */}
                    {s.dailySeq != null ? (
                      <span className="font-bold text-violet-600 dark:text-violet-400">#{s.dailySeq}</span>
                    ) : (
                      <span className="text-slate-400">{idx + 1}</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_DOT[status])} />
                      <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                        {s.childName}
                      </span>
                      {s.isVip && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                    </div>
                    {s.childNotes && (
                      <div className="flex items-start gap-1 mt-0.5 pl-3.5" title={s.childNotes}>
                        <StickyNote className="w-2.5 h-2.5 text-amber-500 flex-shrink-0 mt-[1px]" />
                        <span className="text-[10.5px] font-medium text-amber-700 dark:text-amber-400 truncate max-w-[170px]">
                          {s.childNotes}
                        </span>
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                    {s.parentName}
                  </td>

                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 text-[12.5px]">
                    {s.parentPhone || "—"}
                  </td>

                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{s.entryTime}</td>

                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {exitTimeLabel(s)}
                  </td>

                  <td className="px-3 py-2.5 text-right font-bold">
                    <span className={cn(
                      status === "expiring" ? "text-amber-600 dark:text-amber-400" :
                      status === "expired"  ? "text-rose-700 dark:text-rose-300 font-black" :
                      s.isPaused            ? "text-amber-600 dark:text-amber-400" :
                                              "text-slate-900 dark:text-white",
                    )}>
                      {remainingLabel(s)}
                    </span>
                  </td>

                  <td className="px-3 py-2.5">
                    <span className="inline-block text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {durationLabel(s)}
                    </span>
                  </td>

                  <td className="px-3 py-2.5 text-right text-slate-900 dark:text-white font-semibold">
                    {payments[s.id] ? fmt(total) : <span className="text-slate-400 text-xs">…</span>}
                  </td>

                  <td className="px-3 py-2.5">
                    {payments[s.id]?.method === "mixed" ? (
                      // Karma → explicit tender breakdown (Nakit ₺X · Kart ₺Y)
                      <span className="inline-flex items-center gap-1 flex-wrap">
                        {payments[s.id].cash > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            <Banknote className="w-3 h-3" />{fmt(payments[s.id].cash)}
                          </span>
                        )}
                        {payments[s.id].card > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300">
                            <CreditCard className="w-3 h-3" />{fmt(payments[s.id].card)}
                          </span>
                        )}
                        {payments[s.id].wallet > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300">
                            <Wallet className="w-3 h-3" />{fmt(payments[s.id].wallet)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold",
                        meta.cls,
                      )}>
                        {MIcon && <MIcon className="w-3 h-3" />}
                        {meta.label}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 pr-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <RowBtn
                        onClick={() => onExtend(s.id)}
                        title="Süre uzat"
                        icon={Plus}
                        tone="violet"
                      />
                      {s.isPaused ? (
                        <RowBtn onClick={() => onResume(s.id)} title="Devam" icon={Play} tone="amber" />
                      ) : (s.packageType === "Serbest" || s.totalMinutes === 0) ? (
                        <RowBtn onClick={() => onPause(s.id)} title="Duraklat" icon={Pause} tone="slate" />
                      ) : null}
                      <RowBtn onClick={() => onTimeExpired(s.id)} title="Süresi Bitti — Tek tıkla normal sonlandır" icon={Clock} tone="emerald" />
                      <RowBtn onClick={() => onManualExit(s.id)} title="Manuel Çıkış — Sebep seç" icon={LogOut} tone="rose" />
                      <ReprintLabelsButton session={s} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sessions.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <AlertCircle className="w-3 h-3" />
          Tüm aksiyonlar tek tıkla · realtime güncelleme aktif
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 font-bold whitespace-nowrap", className)}>{children}</th>
}

function RowBtn({
  onClick, title, icon: Icon, tone,
}: {
  onClick: () => void; title: string; icon: typeof Plus
  tone: "violet" | "rose" | "amber" | "slate" | "emerald"
}) {
  const palette = {
    violet:  "bg-violet-600 text-white hover:bg-violet-500",
    rose:    "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-500/25",
    amber:   "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/25",
    slate:   "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
    emerald: "bg-emerald-600 text-white hover:bg-emerald-500",
  }[tone]
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors active:scale-95",
        palette,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}
