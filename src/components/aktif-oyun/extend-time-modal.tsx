"use client"

import { useState, useEffect } from "react"
import { X, Banknote, CreditCard, Wallet, Loader2, Check, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActiveSession } from "@/types/aktif-oyun"
import { formatTime } from "@/types/aktif-oyun"
import { extendSessionWithPayment, convertToUnlimited, getWalletBalance } from "@/lib/services/finance.service"
import { useAuth } from "@/contexts/auth-context"
import { useSessionStore } from "@/lib/stores/session-store"
import { EXTENSION_PRICES, UNLIMITED_MINUTES } from "@/types/finance"
import type { PaymentMethod } from "@/types/finance"
import { toast } from "sonner"

interface ExtendTimeModalProps {
  session: ActiveSession
  onClose: () => void
}

const EXTEND_OPTIONS = [
  {
    minutes: 30,
    label: "+30 dk",
    sublabel: `₺${EXTENSION_PRICES[30]}`,
    color: "from-sky-500 to-blue-600",
    hoverRing: "ring-blue-400/40",
  },
  {
    minutes: 60,
    label: "+60 dk",
    sublabel: `₺${EXTENSION_PRICES[60]}`,
    color: "from-violet-500 to-purple-600",
    hoverRing: "ring-violet-400/40",
  },
  {
    minutes: UNLIMITED_MINUTES,
    label: "Sınırsız",
    sublabel: `₺${EXTENSION_PRICES[UNLIMITED_MINUTES]}`,
    color: "from-emerald-500 to-teal-600",
    hoverRing: "ring-emerald-400/40",
  },
] as const

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: "cash",   label: "Nakit",     icon: Banknote  },
  { value: "card",   label: "Kart",      icon: CreditCard },
  { value: "wallet", label: "Cüzdan",    icon: Wallet    },
  { value: "free",   label: "Ücretsiz",  icon: Check     },
]

export function ExtendTimeModal({ session, onClose }: ExtendTimeModalProps) {
  const { user } = useAuth()
  const { extendEndTime } = useSessionStore()
  const [selectedMins, setSelectedMins] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const isUnlimited = selectedMins === UNLIMITED_MINUTES
  const price = selectedMins !== null ? (EXTENSION_PRICES[selectedMins] ?? 0) : 0
  const paymentAmount = paymentMethod === "free" ? 0 : price
  const walletInsufficient = paymentMethod === "wallet" && walletBalance !== null && walletBalance < paymentAmount

  useEffect(() => {
    if (paymentMethod !== "wallet" || !session.parentId) return
    getWalletBalance(session.parentId)
      .then(setWalletBalance)
      .catch(() => setWalletBalance(0))
  }, [paymentMethod, session.parentId])

  async function handleConfirm() {
    if (selectedMins === null || walletInsufficient) return
    setLoading(true)
    try {
      if (isUnlimited) {
        await convertToUnlimited({
          sessionId: session.id,
          minutes: 9999,
          paymentAmount,
          paymentType: paymentMethod,
          createdBy: user?.id,
        })
        // Clear end time tracking for this session (now unlimited)
        extendEndTime(session.id, 9999)
        toast.success(`${session.childName} — sınırsız pakete geçildi`)
      } else {
        await extendSessionWithPayment({
          sessionId: session.id,
          minutes: selectedMins,
          paymentAmount,
          paymentType: paymentMethod,
          createdBy: user?.id,
        })
        extendEndTime(session.id, selectedMins)
        toast.success(`${session.childName} — +${selectedMins} dk uzatıldı`)
      }
      setDone(true)
      setTimeout(onClose, 1200)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Hata oluştu"
      toast.error("Uzatma başarısız: " + msg)
      setLoading(false)
    }
  }

  const canConfirm = selectedMins !== null && !walletInsufficient && !loading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Süre Uzat</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {session.childName} · {session.parentName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Remaining time pill */}
        <div className="mx-6 mb-5 flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Mevcut kalan:</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white ml-auto tabular-nums">
            {session.remainingSeconds <= 0 ? "Süresi doldu" : session.packageType === "Serbest" ? "∞" : formatTime(session.remainingSeconds)}
          </span>
        </div>

        {done ? (
          <div className="px-6 pb-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              {isUnlimited ? "Sınırsız Pakete Geçildi!" : "Uzatma Başarılı!"}
            </p>
            <p className="text-xs text-slate-500">
              {isUnlimited ? "Süre sınırı kaldırıldı" : `+${selectedMins} dk eklendi`}
            </p>
          </div>
        ) : (
          <>
            {/* Duration options — large tablet-optimized buttons */}
            <div className="px-6 pb-5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Süre Seç</p>
              <div className="grid grid-cols-3 gap-3">
                {EXTEND_OPTIONS.map((opt) => {
                  const isSelected = selectedMins === opt.minutes
                  return (
                    <button
                      key={opt.minutes}
                      onClick={() => setSelectedMins(opt.minutes)}
                      className={cn(
                        "relative py-5 rounded-2xl border-2 transition-all duration-150 text-center active:scale-95",
                        isSelected
                          ? `bg-gradient-to-br ${opt.color} border-transparent text-white shadow-lg ring-4 ${opt.hoverRing}`
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                      )}
                    >
                      {opt.minutes === UNLIMITED_MINUTES ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn("text-xl font-bold", isSelected ? "text-white" : "text-slate-900 dark:text-white")}>∞</span>
                          <span className={cn("text-[10px] font-semibold", isSelected ? "text-white/80" : "text-slate-400")}>
                            {opt.sublabel}
                          </span>
                        </div>
                      ) : (
                        <>
                          <p className={cn("text-base font-bold", isSelected ? "text-white" : "text-slate-900 dark:text-white")}>
                            {opt.label}
                          </p>
                          <p className={cn("text-[10px] mt-0.5 font-semibold", isSelected ? "text-white/80" : "text-slate-400")}>
                            {opt.sublabel}
                          </p>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Payment methods */}
            <div className="px-6 pb-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Ödeme Yöntemi</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon
                  const isSelected = paymentMethod === m.value
                  return (
                    <button
                      key={m.value}
                      onClick={() => setPaymentMethod(m.value)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-3 rounded-xl border text-xs font-semibold transition-all active:scale-95",
                        isSelected
                          ? "bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-500/25"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-400"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {m.label}
                    </button>
                  )
                })}
              </div>

              {/* Wallet balance indicator */}
              {paymentMethod === "wallet" && (
                <div className={cn(
                  "flex items-center justify-between mt-2 p-2.5 rounded-xl text-xs font-medium",
                  walletInsufficient
                    ? "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400"
                    : "bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-400"
                )}>
                  <span>Mevcut bakiye</span>
                  <span className="font-bold tabular-nums">
                    {walletBalance === null ? "Yükleniyor..." : `₺${walletBalance.toLocaleString("tr-TR")}`}
                  </span>
                </div>
              )}
            </div>

            {/* Price summary + confirm */}
            <div className="px-6 pb-6">
              {selectedMins !== null && paymentAmount > 0 && (
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs text-slate-500">Tutar</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    ₺{paymentAmount.toLocaleString("tr-TR")}
                  </span>
                </div>
              )}
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={cn(
                  "w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98]",
                  canConfirm
                    ? "bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                )}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isUnlimited ? (
                  <span className="text-base">∞</span>
                ) : null}
                {loading
                  ? "İşleniyor..."
                  : selectedMins === null
                  ? "Süre Seç"
                  : isUnlimited
                  ? "Sınırsıza Geç"
                  : `+${selectedMins} dk Uzat`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
