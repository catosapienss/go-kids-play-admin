import { Banknote, CreditCard, Wallet, Baby, UserCheck, Clock } from "lucide-react"
import type { Customer, PaymentMethod } from "@/types/crm"
import { cn } from "@/lib/utils"

const METHOD_ICONS: Record<PaymentMethod, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  wallet: Wallet,
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit",
  card: "Kart",
  wallet: "Cüzdan",
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  card: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  wallet: "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",
}

const PKG_COLORS: Record<string, string> = {
  "30dk": "bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400",
  "60dk": "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",
  "90dk": "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "Serbest": "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400",
}

export function VisitHistory({ customer }: { customer: Customer }) {
  if (customer.visits.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
        <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Henüz ziyaret kaydı yok</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto_1fr_1fr] gap-4 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        <span>Tarih</span>
        <span>Çocuk</span>
        <span>Paket</span>
        <span>Süre</span>
        <span>Ödeme</span>
        <span className="text-right">Tutar</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {customer.visits.map((visit) => {
          const MethodIcon = METHOD_ICONS[visit.paymentMethod]
          return (
            <div key={visit.id} className="flex sm:grid sm:grid-cols-[1fr_1fr_1fr_auto_1fr_1fr] gap-4 px-5 py-3.5 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{visit.date.slice(5).replace("-", "/")}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{visit.date.slice(0, 4)}</p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <Baby className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{visit.childName.split(" ")[0]}</span>
              </div>
              <div className="hidden sm:block">
                <span className={cn("px-2 py-0.5 rounded-lg text-xs font-semibold", PKG_COLORS[visit.packageType] ?? "bg-slate-100 text-slate-700")}>
                  {visit.packageType}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="w-3 h-3" />
                {visit.duration}
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium", METHOD_COLORS[visit.paymentMethod])}>
                  <MethodIcon className="w-3 h-3" />
                  {METHOD_LABELS[visit.paymentMethod]}
                </div>
              </div>
              <div className="ml-auto sm:ml-0 sm:text-right">
                <p className="text-sm font-bold text-slate-900 dark:text-white">₺{visit.amount}</p>
                {visit.staffName && (
                  <div className="hidden sm:flex items-center gap-1 justify-end mt-0.5">
                    <UserCheck className="w-2.5 h-2.5 text-slate-400" />
                    <span className="text-[10px] text-slate-400">{visit.staffName}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
