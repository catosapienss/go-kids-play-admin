import Link from "next/link"
import { Crown, Phone, Mail, Calendar, TrendingUp, Wallet, ArrowLeft, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Customer } from "@/types/crm"
import { daysSinceLastVisit } from "@/lib/crm-data"

interface ProfileHeaderProps {
  customer: Customer
}

export function ProfileHeader({ customer }: ProfileHeaderProps) {
  const daysSince = daysSinceLastVisit(customer.lastVisit)
  const memberDays = daysSinceLastVisit(customer.memberSince)
  const memberMonths = Math.floor(memberDays / 30)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-5 shadow-sm">
      {/* Banner */}
      <div className={cn("h-24 bg-gradient-to-r", customer.avatarColor, "relative")}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-16 translate-x-16" />
        <Link
          href="/crm"
          className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-black/20 hover:bg-black/30 rounded-xl text-white text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          CRM
        </Link>
        {customer.isVip && (
          <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 bg-amber-400 rounded-lg text-xs font-bold text-white shadow-sm">
            <Crown className="w-3 h-3" />
            VIP
          </div>
        )}
      </div>

      <div className="px-5 pb-5">
        {/* Avatar overlapping banner */}
        <div className="flex items-end justify-between -mt-8 mb-4">
          <div className={cn("w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-2xl shadow-lg border-4 border-white dark:border-slate-900", customer.avatarColor)}>
            {customer.name.charAt(0)}
          </div>
          <button className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
            Düzenle
          </button>
        </div>

        {/* Name & contacts */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{customer.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>{customer.phone}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>{customer.email}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {memberMonths > 0 ? `${memberMonths} aydır üye` : `${memberDays} gündür üye`}
              </span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCell
            label="Toplam Harcama"
            value={`₺${customer.totalSpend.toLocaleString("tr-TR")}`}
            icon={TrendingUp}
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-50 dark:bg-emerald-500/10"
          />
          <StatCell
            label="Toplam Ziyaret"
            value={customer.totalVisits}
            icon={MapPin}
            color="text-violet-600 dark:text-violet-400"
            bg="bg-violet-50 dark:bg-violet-500/10"
          />
          <StatCell
            label="Son Ziyaret"
            value={daysSince === 0 ? "Bugün" : daysSince === 1 ? "Dün" : `${daysSince} gün önce`}
            icon={Calendar}
            color={daysSince > 30 ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400"}
            bg={daysSince > 30 ? "bg-red-50 dark:bg-red-500/10" : "bg-sky-50 dark:bg-sky-500/10"}
          />
          <StatCell
            label="Cüzdan"
            value={customer.walletBalance > 0 ? `₺${customer.walletBalance.toLocaleString("tr-TR")}` : "—"}
            icon={Wallet}
            color={customer.walletBalance > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}
            bg={customer.walletBalance > 0 ? "bg-blue-50 dark:bg-blue-500/10" : "bg-slate-50 dark:bg-slate-800"}
          />
        </div>

        {/* Allergy & notes alerts */}
        {(customer.allergies || customer.notes) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {customer.allergies && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-xs text-red-700 dark:text-red-400 font-medium">
                <span className="text-base">⚠️</span>
                {customer.allergies}
              </div>
            )}
            {customer.notes && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 font-medium max-w-sm">
                <span className="text-base">📝</span>
                <span className="truncate">{customer.notes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCell({
  label, value, icon: Icon, color, bg,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
  bg: string
}) {
  return (
    <div className={cn("rounded-xl p-3", bg)}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("text-base font-bold", color)}>{value}</p>
    </div>
  )
}
