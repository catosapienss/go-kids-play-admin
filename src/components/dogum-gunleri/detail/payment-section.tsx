import { Banknote, CreditCard, Wallet, ArrowUpDown, Building2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Organization, OrgPaymentMethod } from "@/types/organizasyon"

const METHOD_META: Record<OrgPaymentMethod, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  cash: { label: "Nakit", icon: Banknote, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10" },
  card: { label: "Kart", icon: CreditCard, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/10" },
  wallet: { label: "Cüzdan", icon: Wallet, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-500/10" },
  transfer: { label: "Transfer", icon: Building2, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800" },
}

const TX_TYPE_LABELS = {
  deposit: "Depozito",
  installment: "Taksit",
  full: "Tam Ödeme",
  refund: "İade",
}

export function PaymentSection({ org }: { org: Organization }) {
  const remaining = org.totalAmount - org.paidAmount
  const paidPct = org.totalAmount > 0 ? Math.min(100, Math.round((org.paidAmount / org.totalAmount) * 100)) : 0

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-950 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-10 translate-x-10" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-white/70">Toplam Tutar</p>
            <p className="text-2xl font-bold">₺{org.totalAmount.toLocaleString("tr-TR")}</p>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-3">
            <div className={cn("h-full rounded-full transition-all duration-700", paidPct >= 100 ? "bg-emerald-400" : "bg-amber-400")} style={{ width: `${paidPct}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-white/60">Depozito</p>
              <p className="text-sm font-bold text-emerald-300">₺{org.depositAmount.toLocaleString("tr-TR")}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Ödenen</p>
              <p className="text-sm font-bold text-emerald-300">₺{org.paidAmount.toLocaleString("tr-TR")}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Kalan</p>
              <p className={cn("text-sm font-bold", remaining > 0 ? "text-amber-300" : "text-emerald-300")}>
                {remaining > 0 ? `₺${remaining.toLocaleString("tr-TR")}` : "✓ Tam"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add payment button */}
      {remaining > 0 && (
        <button className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Ödeme Al (Kalan: ₺{remaining.toLocaleString("tr-TR")})
        </button>
      )}

      {/* Payment history */}
      {org.payments.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Ödeme Geçmişi</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {org.payments.map((payment) => {
              const meta = METHOD_META[payment.method]
              const Icon = meta.icon
              return (
                <div key={payment.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", meta.bg)}>
                    <Icon className={cn("w-4 h-4", meta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{TX_TYPE_LABELS[payment.type]}</p>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", meta.bg, meta.color)}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {payment.date.slice(5).replace("-", "/")} · {payment.staffName}
                      {payment.note && ` · ${payment.note}`}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white flex-shrink-0">
                    ₺{payment.amount.toLocaleString("tr-TR")}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
