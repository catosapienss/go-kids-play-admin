"use client"

import Link from "next/link"
import { Crown, Wallet, Phone, ChevronRight, Baby, TrendingUp, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Customer } from "@/types/crm"
import { daysSinceLastVisit } from "@/lib/crm-data"

interface CustomerTableProps {
  customers: Customer[]
}

function LastVisitBadge({ lastVisit }: { lastVisit: string }) {
  const days = daysSinceLastVisit(lastVisit)
  if (days === 0) return <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">Bugün</span>
  if (days === 1) return <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">Dün</span>
  if (days <= 7) return <span className="text-sky-600 dark:text-sky-400 text-xs">{days} gün önce</span>
  if (days <= 30) return <span className="text-amber-600 dark:text-amber-400 text-xs">{days} gün önce</span>
  return <span className="text-red-500 dark:text-red-400 text-xs">{days} gün önce</span>
}

export function CustomerTable({ customers }: CustomerTableProps) {
  if (customers.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
          <Baby className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Müşteri bulunamadı</p>
        <p className="text-xs text-slate-400 mt-1">Arama veya filtre kriterlerini değiştirin</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Table header */}
      <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        <span>Müşteri</span>
        <span>Çocuklar</span>
        <span>Ziyaret</span>
        <span>Harcama</span>
        <span>Son Ziyaret</span>
        <span>Cüzdan</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {customers.map((customer) => (
          <Link
            key={customer.id}
            href={`/crm/${customer.id}`}
            className="flex lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-4 items-center hover:bg-violet-50/50 dark:hover:bg-violet-500/5 transition-colors group"
          >
            {/* Customer info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm", customer.avatarColor)}>
                {customer.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{customer.name}</span>
                  {customer.isVip && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded-md">
                      <Crown className="w-2.5 h-2.5" />VIP
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <Phone className="w-3 h-3" />
                  <span>{customer.phone}</span>
                </div>
              </div>
            </div>

            {/* Children */}
            <div className="hidden lg:flex items-center gap-1.5">
              <Baby className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{customer.children.length}</span>
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {customer.children.slice(0, 2).map((ch) => (
                    <span key={ch.id} className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[60px]">{ch.name.split(" ")[0]}</span>
                  ))}
                  {customer.children.length > 2 && (
                    <span className="text-[10px] text-slate-400">+{customer.children.length - 2}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Visits */}
            <div className="hidden lg:flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{customer.totalVisits}</span>
              <span className="text-xs text-slate-400">ziyaret</span>
            </div>

            {/* Spend */}
            <div className="hidden lg:block">
              <span className="text-sm font-bold text-slate-900 dark:text-white">₺{customer.totalSpend.toLocaleString("tr-TR")}</span>
            </div>

            {/* Last visit */}
            <div className="hidden lg:flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <LastVisitBadge lastVisit={customer.lastVisit} />
            </div>

            {/* Wallet */}
            <div className="hidden lg:block">
              {customer.walletBalance > 0 ? (
                <div className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-violet-500" />
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                    ₺{customer.walletBalance.toLocaleString("tr-TR")}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>

            {/* Arrow */}
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors flex-shrink-0 hidden lg:block" />

            {/* Mobile: compact info */}
            <div className="flex lg:hidden items-center gap-2 ml-auto flex-shrink-0">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900 dark:text-white">₺{customer.totalSpend.toLocaleString("tr-TR")}</p>
                <LastVisitBadge lastVisit={customer.lastVisit} />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
