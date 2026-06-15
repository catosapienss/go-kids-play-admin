import { Users, TrendingUp, Wallet, Crown } from "lucide-react"
import type { Customer } from "@/types/crm"

interface CrmStatsBarProps {
  customers: Customer[]
}

export function CrmStatsBar({ customers }: CrmStatsBarProps) {
  const totalCustomers = customers.length
  const totalRevenue = customers.reduce((s, c) => s + c.totalSpend, 0)
  const totalWallet = customers.reduce((s, c) => s + c.walletBalance, 0)
  const vipCount = customers.filter((c) => c.isVip).length

  const stats = [
    {
      label: "Toplam Müşteri",
      value: totalCustomers,
      icon: Users,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-100 dark:bg-violet-500/10",
    },
    {
      label: "Toplam Ciro",
      value: `₺${totalRevenue.toLocaleString("tr-TR")}`,
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-500/10",
    },
    {
      label: "Cüzdan Bakiyesi",
      value: `₺${totalWallet.toLocaleString("tr-TR")}`,
      icon: Wallet,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-500/10",
    },
    {
      label: "VIP Müşteri",
      value: vipCount,
      icon: Crown,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/10",
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.bg}`}>
                <Icon className={`w-4.5 h-4.5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{stat.label}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{stat.value}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
