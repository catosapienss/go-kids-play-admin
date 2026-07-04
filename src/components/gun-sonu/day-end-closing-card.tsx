"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Banknote, CreditCard, Wallet, ShieldCheck, AlertTriangle, CheckCircle2,
  Lock, Loader2, FileSignature, Printer,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import {
  getExpectedTotals, getTodayRegister, closeCashRegister, openCashRegister,
} from "@/lib/services/cash-register.service"
import {
  type CashRegister, type ExpectedTotals, isReconciled,
} from "@/types/cash-register"
import { CashCountInput } from "./cash-count-input"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"

// ─── Day-End Closing Card ─────────────────────────────────────────────────────
//
// The interactive primary widget on `/gun-sonu`. Flow:
//
//   1. Loads today's expected totals + (any) existing register row.
//   2. If the register is already closed → renders the locked snapshot.
//   3. Otherwise renders the 3-method count grid, mandatory notes when there
//      is a discrepancy, and a "Kasayı Kapat" button gated to manager+ roles.
//
// Cashiers can see the page but the close button is disabled with a hint.

function fmt(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function DayEndClosingCard({ onClosed }: { onClosed?: (r: CashRegister) => void } = {}) {
  const { user } = useAuth()
  const reconnectToken = useReconnectToken()

  const [expected, setExpected] = useState<ExpectedTotals | null>(null)
  const [register, setRegister] = useState<CashRegister | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Counted entries — operator-typed.
  const [countedCash,   setCountedCash]   = useState(0)
  const [countedCard,   setCountedCard]   = useState(0)
  const [countedWallet, setCountedWallet] = useState(0)
  // Cash deliberately LEFT in the drawer overnight (float for the next day's
  // opening change). Persisted in the closing row's meta so it's visible on
  // the read-only summary and in ClosingHistory.
  const [leftInDrawer,  setLeftInDrawer]  = useState(0)
  const [notes, setNotes] = useState("")

  const canClose = !!user && ["super_admin", "admin", "manager"].includes(user.role)
  const alreadyClosed = register?.status === "closed"

  // ── Bootstrap: open the register (idempotent) + fetch expected/state ──────
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        // Lazy-open: ensures there's a row to update later.
        await openCashRegister().catch(() => undefined)
        const [exp, reg] = await Promise.all([
          getExpectedTotals(),
          getTodayRegister(),
        ])
        if (cancelled) return
        setExpected(exp)
        setRegister(reg)
        // Seed counted-from-expected so the operator only adjusts deltas.
        if (reg?.status !== "closed") {
          setCountedCash(0)
          setCountedCard(0)
          setCountedWallet(0)
        }
      } catch (e) {
        toast.error("Kasa verisi yüklenemedi", {
          description: e instanceof Error ? e.message : String(e),
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [reconnectToken])

  // ── Derived diffs (live as operator types) ────────────────────────────────
  const diffs = useMemo(() => {
    if (!expected) return null
    return {
      cash:   countedCash   - expected.expectedCash,
      card:   countedCard   - expected.expectedCard,
      wallet: countedWallet - expected.expectedWallet,
    }
  }, [expected, countedCash, countedCard, countedWallet])

  const anyDiff = diffs ? !isReconciled(diffs.cash) || !isReconciled(diffs.card) || !isReconciled(diffs.wallet) : false
  const totalCounted = countedCash + countedCard + countedWallet
  const totalDiff = diffs ? diffs.cash + diffs.card + diffs.wallet : 0

  const notesRequired = anyDiff && notes.trim().length === 0

  async function handleClose() {
    if (submitting) return
    if (notesRequired) {
      toast.warning("Fark olduğunda not yazmak zorunludur")
      return
    }
    setSubmitting(true)
    try {
      const closed = await closeCashRegister({
        countedCash,
        countedCard,
        countedWallet,
        notes: notes.trim(),
        meta: { left_in_drawer: leftInDrawer },
      })
      setRegister(closed)
      toast.success("Kasa kapatıldı", {
        description: isReconciled(closed.diffCash + closed.diffCard + closed.diffWallet)
          ? "Mutabakat tutuyor."
          : `Toplam fark: ₺${fmt(closed.diffCash + closed.diffCard + closed.diffWallet)}`,
      })
      onClosed?.(closed)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Kasa kapatılamadı"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render: loading state ──────────────────────────────────────────────────
  if (loading || !expected) {
    return (
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
      </div>
    )
  }

  // ── Render: already closed (read-only snapshot) ───────────────────────────
  if (alreadyClosed && register) {
    return (
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-6 py-4 bg-emerald-50/60 dark:bg-emerald-500/[0.06] border-b border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Kasa Kapandı</h2>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
              {register.closedAt && new Date(register.closedAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}
              {register.closedByName && ` · ${register.closedByName}`}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
          >
            <Printer className="w-3 h-3" /> Yazdır
          </button>
        </div>
        <div className="p-6 grid grid-cols-3 gap-4">
          <ClosedMethod label="Nakit"  expected={register.expectedCash}   counted={register.countedCash}   diff={register.diffCash}   />
          <ClosedMethod label="Kart"   expected={register.expectedCard}   counted={register.countedCard}   diff={register.diffCard}   />
          <ClosedMethod label="Cüzdan" expected={register.expectedWallet} counted={register.countedWallet} diff={register.diffWallet} />
        </div>
        {Number(register.meta?.left_in_drawer ?? 0) > 0 && (
          <div className="px-6 pb-4 -mt-2">
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/[0.05] px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300">
                  Kasada Bırakılan Nakit
                </p>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-300/70 mt-0.5">
                  Yarınki para üstü için tezgahta kalan
                </p>
              </div>
              <span className="text-lg font-bold tabular-nums text-amber-800 dark:text-amber-200">
                ₺{Number(register.meta.left_in_drawer).toLocaleString("tr-TR")}
              </span>
            </div>
          </div>
        )}
        {register.notes && (
          <div className="px-6 pb-5 -mt-2">
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">Notlar</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">{register.notes}</p>
          </div>
        )}
      </div>
    )
  }

  // ── Render: active closing flow ───────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Kasa Kapanış
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sayım yap · farkı not düş · onayla
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Beklenen Toplam</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white leading-none mt-1">
            ₺{fmt(expected.expectedTotal)}
          </p>
        </div>
      </div>

      {/* Count grid */}
      <div className="p-5 space-y-3">
        <CashCountInput
          label="Nakit"
          icon={Banknote}
          tone="emerald"
          value={countedCash}
          onChange={setCountedCash}
          expected={expected.expectedCash}
          disabled={!canClose}
        />
        <CashCountInput
          label="Kart Toplamı"
          icon={CreditCard}
          tone="blue"
          value={countedCard}
          onChange={setCountedCard}
          expected={expected.expectedCard}
          disabled={!canClose}
        />
        <CashCountInput
          label="Cüzdan (Sistem)"
          icon={Wallet}
          tone="violet"
          value={countedWallet}
          onChange={setCountedWallet}
          expected={expected.expectedWallet}
          disabled={!canClose}
        />
      </div>

      {/* Summary row */}
      <div className="px-6 pb-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Toplam Sayılan</p>
          <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">₺{fmt(totalCounted)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Toplam Fark</p>
          <p className={cn(
            "text-xl font-bold tabular-nums",
            isReconciled(totalDiff)
              ? "text-emerald-600 dark:text-emerald-400"
              : totalDiff < 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-amber-600 dark:text-amber-400",
          )}>
            {isReconciled(totalDiff) ? "✓ ₺0" : (totalDiff > 0 ? "+" : "") + "₺" + fmt(totalDiff)}
          </p>
        </div>
      </div>

      {/* Cash left in drawer — deliberate float for the next day. Stored
          in meta.left_in_drawer so it shows on the closed summary too. */}
      <div className="px-6 pb-4">
        <label className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300 mb-1">
          Kasada Bırakılan Nakit
          <span className="text-slate-400 normal-case tracking-normal">· yarınki para üstü için</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">₺</span>
          <input
            type="number"
            min={0}
            step={5}
            value={leftInDrawer || ""}
            onChange={(e) => setLeftInDrawer(parseFloat(e.target.value) || 0)}
            disabled={!canClose || submitting}
            placeholder="Örn. 200"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/30 tabular-nums"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="px-6 pb-5">
        <label className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">
          <FileSignature className="w-3 h-3" />
          Notlar
          {anyDiff && <span className="text-rose-500 normal-case tracking-normal">*</span>}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!canClose || submitting}
          rows={3}
          placeholder={anyDiff
            ? "Fark nedenini kısaca açıkla — POS sorunu, müşteri iadesi, yanlış kabul, vs."
            : "Bugün için ek bir not yazılabilir (zorunlu değil)"}
          className={cn(
            "w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30 resize-none",
            notesRequired
              ? "border-rose-300 dark:border-rose-700/60 focus:border-rose-400"
              : "border-slate-200 dark:border-slate-700 focus:border-violet-400",
          )}
        />
        {notesRequired && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Fark olduğunda not yazmak zorunludur.
          </p>
        )}
      </div>

      {/* Footer / submit */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
        {anyDiff ? (
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs flex-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-semibold">Mutabakat farkı tespit edildi.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs flex-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-semibold">Tutarlı — kapatmaya hazır.</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleClose}
          disabled={!canClose || submitting || notesRequired}
          className={cn(
            "min-h-[44px] px-5 rounded-xl font-bold text-sm text-white transition-colors flex items-center gap-2",
            !canClose
              ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
              : anyDiff
              ? "bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              : "bg-violet-600 hover:bg-violet-700 disabled:opacity-50",
          )}
          title={!canClose ? "Kasa kapatma için yönetici yetkisi gerekli" : undefined}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Kapatılıyor…</>
          ) : !canClose ? (
            <><Lock className="w-4 h-4" /> Yetki yok</>
          ) : (
            <><ShieldCheck className="w-4 h-4" /> Kasayı Kapat</>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Read-only snapshot block ─────────────────────────────────────────────────

function ClosedMethod({ label, expected, counted, diff }: {
  label: string; expected: number; counted: number; diff: number
}) {
  const ok = isReconciled(diff)
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-900/40 p-3">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
        ₺{fmt(counted)}
      </p>
      <p className="text-[11px] text-slate-500 tabular-nums">Bekl: ₺{fmt(expected)}</p>
      <p className={cn(
        "text-[11px] font-bold tabular-nums mt-1",
        ok ? "text-emerald-600 dark:text-emerald-400"
          : diff < 0 ? "text-rose-600 dark:text-rose-400"
          : "text-amber-600 dark:text-amber-400",
      )}>
        {ok ? "✓ Tutuyor" : (diff > 0 ? "+" : "") + "₺" + fmt(diff)}
      </p>
    </div>
  )
}
