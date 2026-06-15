"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ShoppingBag, X, ChevronRight, Check, CheckCircle2, Loader2, Sparkles,
  Wallet, CreditCard, ShieldCheck, KeyRound, Copy, Baby, Clock, Lock,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { BRAND } from "@/lib/brand"
import {
  PACKAGE_CATALOG, type PackageOption,
  type Reservation, type PaymentProvider,
} from "@/types/mobile-purchase"
import {
  purchasePackage,
} from "@/lib/services/mobile-purchase.service"
import type { ParentBundle } from "@/lib/services/parent-portal.service"
import type { ChildLite } from "@/lib/services/entry-code.service"

// ─── Mobile Purchase Flow ─────────────────────────────────────────────────────
//
// A single component that hosts both the store catalog AND the 4-step
// purchase sheet (package → child → payment → confirm). Modelled as a single
// modal so the parent stays focused; back button returns step-by-step.
//
// Steps:
//   0  → Catalog (this is what the Store CTA opens)
//   1  → Child select (only shown if more than one child)
//   2  → Payment method (wallet / card / mixed)
//   3  → Receipt (entry code + confirmation)

interface Props {
  open: boolean
  onClose: () => void
  bundle: ParentBundle
  /** Called on successful purchase so the parent shell can refresh wallet + lists. */
  onPurchaseComplete: (reservation: Reservation) => void
}

type Step = "catalog" | "child" | "payment" | "receipt"

function fmtTRY(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

const TONE: Record<PackageOption["tone"], { card: string; price: string; chip: string; gradient: string }> = {
  blue:    { card: "border-blue-300/60 dark:border-blue-700/50",       price: "text-blue-700 dark:text-blue-300",       chip: "bg-blue-500/15 text-blue-700 dark:text-blue-300",       gradient: "from-blue-500 to-indigo-600" },
  violet:  { card: "border-violet-300/60 dark:border-violet-700/50",   price: "text-violet-700 dark:text-violet-300",   chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300",   gradient: "from-violet-500 to-purple-600" },
  indigo:  { card: "border-indigo-300/60 dark:border-indigo-700/50",   price: "text-indigo-700 dark:text-indigo-300",   chip: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",   gradient: "from-indigo-500 to-blue-600" },
  fuchsia: { card: "border-fuchsia-300/60 dark:border-fuchsia-700/50", price: "text-fuchsia-700 dark:text-fuchsia-300", chip: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300", gradient: "from-fuchsia-500 to-pink-600" },
}

export function ParentPurchaseFlow({ open, onClose, bundle, onPurchaseComplete }: Props) {
  const [step, setStep] = useState<Step>("catalog")
  const [pkg, setPkg]   = useState<PackageOption | null>(null)
  const [child, setChild] = useState<ChildLite | null>(null)
  // Payment composition. Wallet capped at parent's balance — the parent slider
  // can move it between 0 and min(price, balance).
  const [walletPart, setWalletPart] = useState(0)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [busy, setBusy] = useState(false)

  // Reset state whenever the modal opens fresh.
  useEffect(() => {
    if (!open) return
    setStep("catalog")
    setPkg(null)
    setChild(null)
    setWalletPart(0)
    setReservation(null)
  }, [open])

  // Auto-advance child step if there's only one (or none) so we don't waste taps.
  useEffect(() => {
    if (step !== "child") return
    if (bundle.children.length === 0) {
      setChild(null); setStep("payment")
    } else if (bundle.children.length === 1) {
      setChild(bundle.children[0]); setStep("payment")
    }
  }, [step, bundle.children])

  // Escape closes; backdrop click closes.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const walletBalance = Number(bundle.parent.wallet_balance) || 0

  // When the package changes default the wallet portion to a sensible value.
  useEffect(() => {
    if (!pkg) return
    setWalletPart(Math.min(pkg.price, walletBalance))
  }, [pkg, walletBalance])

  async function confirmPurchase() {
    if (!pkg || busy) return
    setBusy(true)
    try {
      const cardPart = Math.max(0, pkg.price - walletPart)
      const r = await purchasePackage({
        parentId:     bundle.parent.id,
        childId:      child?.id ?? null,
        packageId:    pkg.id,
        walletAmount: walletPart,
        cardAmount:   cardPart,
        cashAmount:   0,
        provider:     (cardPart > 0 ? "simulated" : "wallet") as PaymentProvider,
      })
      setReservation(r)
      setStep("receipt")
      onPurchaseComplete(r)
      toast.success("Satın alma başarılı")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Satın alma başarısız")
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]"
        onClick={onClose}
      />

      {/* Sheet (bottom on mobile, centred on desktop) */}
      <div
        className={cn(
          "relative w-full max-w-md bg-white dark:bg-slate-900",
          "rounded-t-3xl sm:rounded-3xl",
          "max-h-[92vh] flex flex-col overflow-hidden",
          "shadow-2xl",
          "animate-[sheetUp_220ms_ease-out]",
        )}
      >
        <SheetHeader step={step} onClose={onClose} onBack={
          step === "catalog" ? null
          : step === "child"   ? () => setStep("catalog")
          : step === "payment" ? () => setStep(bundle.children.length > 1 ? "child" : "catalog")
          : null
        } />

        <div className="flex-1 overflow-y-auto">
          {step === "catalog" && (
            <CatalogStep
              onPick={(p) => {
                setPkg(p)
                setStep(bundle.children.length > 1 ? "child" : "payment")
                if (bundle.children.length <= 1) setChild(bundle.children[0] ?? null)
              }}
            />
          )}
          {step === "child" && pkg && (
            <ChildStep
              children={bundle.children}
              onPick={(c) => { setChild(c); setStep("payment") }}
            />
          )}
          {step === "payment" && pkg && (
            <PaymentStep
              pkg={pkg}
              walletBalance={walletBalance}
              walletPart={walletPart}
              setWalletPart={setWalletPart}
              busy={busy}
              onConfirm={confirmPurchase}
            />
          )}
          {step === "receipt" && reservation && pkg && (
            <ReceiptStep
              reservation={reservation}
              pkg={pkg}
              child={child}
              onDone={onClose}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sheetUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Sheet header ────────────────────────────────────────────────────────────

function SheetHeader({ step, onClose, onBack }: {
  step: Step
  onClose: () => void
  onBack: (() => void) | null
}) {
  const titles: Record<Step, string> = {
    catalog: "Paket Mağazası",
    child:   "Çocuk Seç",
    payment: "Ödeme",
    receipt: "Hazır!",
  }
  return (
    <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Geri"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 -ml-1"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
      ) : <div className="w-9 -ml-1" />}

      <div className="flex-1 text-center">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{titles[step]}</p>
        <StepIndicator step={step} />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 -mr-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function StepIndicator({ step }: { step: Step }) {
  const order: Step[] = ["catalog", "child", "payment", "receipt"]
  const idx = order.indexOf(step)
  return (
    <div className="flex items-center justify-center gap-1 mt-1.5">
      {order.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1 rounded-full transition-all",
            i === idx
              ? "w-5 bg-violet-500"
              : i < idx
              ? "w-2 bg-violet-300 dark:bg-violet-700"
              : "w-2 bg-slate-200 dark:bg-slate-700",
          )}
        />
      ))}
    </div>
  )
}

// ─── Step 1: Catalog ─────────────────────────────────────────────────────────

function CatalogStep({ onPick }: { onPick: (p: PackageOption) => void }) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 px-1">
        Bu hafta için bir paket seç
      </p>
      {PACKAGE_CATALOG.map((p) => {
        const t = TONE[p.tone]
        const isUnlimited = p.durationMinutes === 0
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            className={cn(
              "w-full rounded-2xl border-2 bg-white dark:bg-slate-900 p-4 text-left",
              "flex items-center gap-4 transition-all",
              "hover:shadow-md active:scale-[0.99]",
              t.card,
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center flex-shrink-0",
              t.gradient,
            )}>
              {isUnlimited ? <Sparkles className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-base font-bold text-slate-900 dark:text-white">{p.name}</p>
                {p.badge && (
                  <span className={cn("text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full", t.chip)}>
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.tagline}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={cn("text-xl font-black tabular-nums", t.price)}>{fmtTRY(p.price)}</p>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 inline-block mt-1" />
            </div>
          </button>
        )
      })}

      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center pt-2 leading-relaxed">
        Tüm paketler tesise vardığında kullanılır.
        Aktif kalış süresi 7 gündür.
      </p>
    </div>
  )
}

// ─── Step 2: Child ───────────────────────────────────────────────────────────

function ChildStep({ children, onPick }: { children: ChildLite[]; onPick: (c: ChildLite) => void }) {
  return (
    <div className="p-4 space-y-2">
      <p className="text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 px-1 mb-2">
        Hangi çocuk için?
      </p>
      {children.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c)}
          className={cn(
            "w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
            "p-4 flex items-center gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors",
          )}
        >
          <div className="w-11 h-11 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
            <Baby className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.age} yaş</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        </button>
      ))}
    </div>
  )
}

// ─── Step 3: Payment ─────────────────────────────────────────────────────────

function PaymentStep({
  pkg, walletBalance, walletPart, setWalletPart, busy, onConfirm,
}: {
  pkg: PackageOption
  walletBalance: number
  walletPart: number
  setWalletPart: (n: number) => void
  busy: boolean
  onConfirm: () => void
}) {
  const cardPart = Math.max(0, pkg.price - walletPart)
  const walletCap = Math.min(pkg.price, walletBalance)
  const useFullWallet = walletPart >= walletCap && walletCap > 0
  const useFullCard   = walletPart === 0

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">
              Toplam
            </p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{fmtTRY(pkg.price)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">
              Paket
            </p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{pkg.name}</p>
          </div>
        </div>
      </div>

      {/* Method picker */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 px-1">
          Ödeme yöntemi
        </p>

        {/* Wallet option */}
        <button
          type="button"
          onClick={() => setWalletPart(walletCap)}
          disabled={walletCap <= 0}
          className={cn(
            "w-full rounded-2xl border-2 p-4 flex items-center gap-3 text-left transition-colors",
            useFullWallet
              ? "border-violet-500 bg-violet-50/60 dark:bg-violet-500/[0.08]"
              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
            walletCap <= 0 && "opacity-50 cursor-not-allowed",
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Cüzdan</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Bakiye: {fmtTRY(walletBalance)}
              {walletCap < pkg.price && walletCap > 0 && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">· yetersiz</span>
              )}
            </p>
          </div>
          {useFullWallet && <Check className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
        </button>

        {/* Card option */}
        <button
          type="button"
          onClick={() => setWalletPart(0)}
          className={cn(
            "w-full rounded-2xl border-2 p-4 flex items-center gap-3 text-left transition-colors",
            useFullCard
              ? "border-violet-500 bg-violet-50/60 dark:bg-violet-500/[0.08]"
              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Kart ile öde</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Güvenli ödeme · demo modunda
            </p>
          </div>
          {useFullCard && <Check className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
        </button>

        {/* Mix option — only when wallet has SOME balance but not enough for full */}
        {walletCap > 0 && walletCap < pkg.price && (
          <div
            className={cn(
              "rounded-2xl border-2 p-4",
              !useFullWallet && !useFullCard
                ? "border-violet-500 bg-violet-50/60 dark:bg-violet-500/[0.08]"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
            )}
          >
            <button
              type="button"
              onClick={() => setWalletPart(walletCap)}
              className="w-full flex items-center gap-3 text-left mb-2"
            >
              <div className="w-10 h-10 rounded-xl bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">Karma ödeme</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {fmtTRY(walletPart)} cüzdan + {fmtTRY(cardPart)} kart
                </p>
              </div>
            </button>
            <input
              type="range"
              min={0}
              max={walletCap}
              step={10}
              value={walletPart}
              onChange={(e) => setWalletPart(Number(e.target.value))}
              className="w-full accent-violet-500"
              aria-label="Cüzdan kullanım miktarı"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 tabular-nums">
              <span>0</span>
              <span>{fmtTRY(walletCap)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Pay button */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className={cn(
          "w-full min-h-[52px] rounded-2xl font-bold text-base text-white",
          "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500",
          "shadow-lg shadow-violet-500/25 transition-all",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "flex items-center justify-center gap-2 mt-2",
        )}
      >
        {busy ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Onaylanıyor…</>
        ) : (
          <><ShieldCheck className="w-4 h-4" /> {fmtTRY(pkg.price)} öde</>
        )}
      </button>

      {/* Trust strip */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 pt-1">
        <Lock className="w-2.5 h-2.5" />
        Bilgilerin şifrelenir · iade güvencesi
      </div>
    </div>
  )
}

// ─── Step 4: Receipt ─────────────────────────────────────────────────────────

function ReceiptStep({
  reservation, pkg, child, onDone,
}: {
  reservation: Reservation
  pkg: PackageOption
  child: ChildLite | null
  onDone: () => void
}) {
  async function copyCode() {
    if (!reservation.entryCode) return
    try {
      await navigator.clipboard.writeText(reservation.entryCode)
      toast.success("Kod kopyalandı")
    } catch { toast.error("Kopyalanamadı") }
  }

  return (
    <div className="p-5 space-y-5">
      {/* Success header */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-3xl bg-emerald-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Hazırsın!</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Satın alma başarıyla tamamlandı.
        </p>
      </div>

      {/* Code card */}
      <div className="rounded-3xl border-2 border-dashed border-violet-300 dark:border-violet-700/60 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-500/[0.08] dark:to-fuchsia-500/[0.06] p-5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-violet-600 dark:text-violet-300 mb-2">
          <KeyRound className="w-3 h-3" />
          Giriş Kodu
        </div>
        <p className="font-mono font-black tracking-[0.15em] text-center text-slate-900 dark:text-white text-4xl mb-3">
          {reservation.entryCode ?? "—"}
        </p>
        <button
          type="button"
          onClick={copyCode}
          disabled={!reservation.entryCode}
          className="w-full min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Copy className="w-3.5 h-3.5" />
          Kodu Kopyala
        </button>
      </div>

      {/* Receipt details */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        <Row label="Paket" value={pkg.name} />
        {child && <Row label="Çocuk" value={child.name} />}
        <Row label="Geçerlilik" value={new Date(reservation.expiresAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })} />
        {reservation.walletAmount > 0 && <Row label="Cüzdan" value={fmtTRY(reservation.walletAmount)} />}
        {reservation.cardAmount > 0 && <Row label="Kart" value={fmtTRY(reservation.cardAmount)} />}
        <Row label="Toplam" value={fmtTRY(reservation.amount)} bold />
      </div>

      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-3 flex items-start gap-2.5">
        <ShoppingBag className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
          Tesise vardığında kasiyere bu kodu söyle. Paketin otomatik olarak başlatılacak.
        </p>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="w-full min-h-[48px] rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold"
        style={{ backgroundColor: BRAND.primary[700] }}
      >
        Tamam, kapat
      </button>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <span className={cn("text-sm tabular-nums", bold ? "font-black text-slate-900 dark:text-white" : "font-semibold text-slate-700 dark:text-slate-200")}>
        {value}
      </span>
    </div>
  )
}
