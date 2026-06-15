"use client"

import Link from "next/link"
import { ChevronRight, Clock, Users, Wallet, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Organization } from "@/types/organizasyon"
import { getPackageById } from "@/lib/organizasyon-data"
import { OrgStatusBadge, PaymentStatusBadge } from "./org-status-badge"

interface OrgListProps {
  organizations: Organization[]
}

export function OrgList({ organizations }: OrgListProps) {
  if (organizations.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
          <CalendarDays className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Organizasyon bulunamadı</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {organizations.map((org) => {
        const pkg = getPackageById(org.packageId)
        const paidPct = org.totalAmount > 0 ? Math.min(100, (org.paidAmount / org.totalAmount) * 100) : 0

        return (
          <Link
            key={org.id}
            href={`/dogum-gunleri/${org.id}`}
            className="group flex flex-col sm:flex-row sm:items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md transition-all"
          >
            {/* Package color bar + avatar */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shadow-sm", pkg?.gradient ?? "from-violet-500 to-purple-600")}>
                  {org.childName.charAt(0)}
                </div>
                {org.status === "ongoing" && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{org.name}</span>
                  <OrgStatusBadge status={org.status} />
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {org.date.slice(5).replace("-", "/")} {org.startTime}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {org.childCount + org.extraChildCount} çocuk
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {org.startTime}–{org.endTime}
                  </div>
                  {pkg && (
                    <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r text-white", pkg.gradient)}>
                      {pkg.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Payment section */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="hidden sm:block text-right min-w-[100px]">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <Wallet className="w-3 h-3 text-slate-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">₺{org.totalAmount.toLocaleString("tr-TR")}</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", paidPct >= 100 ? "bg-emerald-500" : paidPct > 0 ? "bg-amber-500" : "bg-red-400")}
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
                <div className="mt-1">
                  <PaymentStatusBadge status={org.paymentStatus} />
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors flex-shrink-0" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
