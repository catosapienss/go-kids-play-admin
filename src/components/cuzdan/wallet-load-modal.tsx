"use client"

import { useState } from "react"
import { Wallet, Banknote, CreditCard, Gift, Check, X, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { CustomerWallet } from "@/types/cuzdan"
import { loadWallet } from "@/lib/services/finance.service"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

const QUICK_AMOUNTS = [100, 200, 500, 1000]
const BONUS_TIERS = [
  { min: 500, bonus: 50, label: "₺50 bonus" },
  { min: 1000, bonus: 100, label: "₺100 bonus" },
]

type LoadMethod = "cash" | "card"

interface WalletLoadModalProps {
  wallet: CustomerWallet | null
  onClose: () => void
  onLoaded?: () => void
}

export function WalletLoadModal({ wallet, onClose, onLoaded }: WalletLoadModalProps) {
  const { user } = useAuth()
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<LoadMethod>("card")
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!wallet) return null

  const numericAmount = parseInt(amount) || 0
  const bonusTier = BONUS_TIERS.filter((t) => numericAmount >= t.min).pop()
  const bonusAmount = bonusTier?.bonus ?? 0
  const newBalance = wallet.balance + numericAmount + bonusAmount

  async function handleLoad() {
    if (numericAmount < 50) return
    setLoading(true)
    try {
      await loadWallet({
        parentId: wallet!.id,
        amount: numericAmount,
        bonus: bonusAmount,
        description: `Cüzdan yüklemesi (${method === "cash" ? "Nakit" : "Kart"})`,
        method,
        createdBy: user?.id,
      })
      setConfirmed(true)
      toast.success(`₺${numericAmount.toLocaleString("tr-TR")} yüklendi${bonusAmount > 0 ? ` + ₺${bonusAmount} bonus` : ""}`)
      setTimeout(() => {
        setConfirmed(false)
        setAmount("")
        onLoaded?.()
        onClose()
      }, 1800)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Hata oluştu"
      toast.error("Yükleme başarısız: " + msg)
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!wallet} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <DialogTitle>Cüzdan Yükleme</DialogTitle>
          </div>
        </DialogHeader>

        {confirmed ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Yükleme Başarılı!</p>
            <p className="text-xs text-slate-500">
              ₺{numericAmount.toLocaleString("tr-TR")} yüklendi
              {bonusAmount > 0 && ` + ₺${bonusAmount} bonus kazanıldı`}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Customer info */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {wallet.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{wallet.name}</p>
                <p className="text-xs text-slate-500">{wallet.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Mevcut Bakiye</p>
                <p className="text-sm font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                  ₺{(wallet.balance + wallet.bonusBalance).toLocaleString("tr-TR")}
                </p>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                Yükleme Tutarı
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-lg">₺</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min="50"
                  className="w-full pl-8 pr-4 py-3 text-xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-900 dark:text-white tabular-nums"
                />
              </div>
              {/* Quick amounts */}
              <div className="flex gap-2 mt-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(String(q))}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                      numericAmount === q
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-400"
                    )}
                  >
                    ₺{q}
                  </button>
                ))}
              </div>
            </div>

            {/* Bonus indicator */}
            {numericAmount >= 500 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                <Gift className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {bonusTier?.label} kampanyası aktif!
                </p>
              </div>
            )}

            {/* Payment method */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                Ödeme Yöntemi
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "cash", label: "Nakit", icon: Banknote },
                  { value: "card", label: "Kart", icon: CreditCard },
                ] as { value: LoadMethod; label: string; icon: React.ElementType }[]).map((m) => {
                  const Icon = m.icon
                  return (
                    <button
                      key={m.value}
                      onClick={() => setMethod(m.value)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors",
                        method === m.value
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-400"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* New balance preview */}
            {numericAmount > 0 && (
              <div className="flex items-center justify-between p-3 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-xl">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">Yeni Bakiye</p>
                <div className="text-right">
                  <p className="text-lg font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                    ₺{newBalance.toLocaleString("tr-TR")}
                  </p>
                  {bonusAmount > 0 && (
                    <p className="text-[10px] text-amber-600">+₺{bonusAmount} bonus dahil</p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors"
              >
                <X className="w-4 h-4" />
                Vazgeç
              </button>
              <button
                onClick={handleLoad}
                disabled={numericAmount < 50 || loading}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                  numericAmount >= 50 && !loading
                    ? "bg-violet-600 hover:bg-violet-700 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                )}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                {loading ? "İşleniyor..." : `₺${numericAmount > 0 ? numericAmount.toLocaleString("tr-TR") : "—"} Yükle`}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
