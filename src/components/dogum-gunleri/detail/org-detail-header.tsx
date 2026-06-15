import Link from "next/link"
import { ArrowLeft, Phone, User, CalendarDays, Clock, Users, Palette, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Organization } from "@/types/organizasyon"
import { getPackageById } from "@/lib/organizasyon-data"
import { OrgStatusBadge, PaymentStatusBadge } from "../org-status-badge"

export function OrgDetailHeader({ org }: { org: Organization }) {
  const pkg = getPackageById(org.packageId)
  const paidPct = org.totalAmount > 0 ? Math.min(100, (org.paidAmount / org.totalAmount) * 100) : 0
  const remaining = org.totalAmount - org.paidAmount

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-5 shadow-sm">
      {/* Gradient banner */}
      <div className={cn("h-28 bg-gradient-to-r relative overflow-hidden", pkg?.gradient ?? "from-violet-500 to-purple-600")}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-white/5 -translate-y-20 translate-x-20" />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full bg-white/5 translate-y-12" />
        <Link
          href="/dogum-gunleri"
          className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-black/20 hover:bg-black/30 rounded-xl text-white text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Organizasyonlar
        </Link>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <OrgStatusBadge status={org.status} />
          <PaymentStatusBadge status={org.paymentStatus} />
        </div>
        {org.decorTheme && (
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 px-2.5 py-1 bg-black/20 rounded-xl text-white text-xs font-medium">
            <Palette className="w-3 h-3" />
            {org.decorTheme}
          </div>
        )}
      </div>

      <div className="px-5 pb-5">
        {/* Avatar + title */}
        <div className="flex items-end justify-between -mt-7 mb-4">
          <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-2xl shadow-lg border-4 border-white dark:border-slate-900", pkg?.gradient)}>
            {org.childName.charAt(0)}
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Düzenle
            </button>
            <button className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm">
              İşlem Yap
            </button>
          </div>
        </div>

        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{org.name}</h1>

        {/* Info grid */}
        <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400 mb-5">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            {org.parentName}
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            {org.parentPhone}
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            {org.date.slice(0, 10).replace(/-/g, "/")}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {org.startTime} – {org.endTime}
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {org.childCount + org.extraChildCount} çocuk
          </div>
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            {org.responsibleStaff}
          </div>
        </div>

        {/* Payment progress */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ödeme Durumu</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">₺{org.totalAmount.toLocaleString("tr-TR")}</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
            <div
              className={cn("h-full rounded-full transition-all duration-700", paidPct >= 100 ? "bg-emerald-500" : paidPct > 0 ? "bg-amber-500" : "bg-red-400")}
              style={{ width: `${paidPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ödendi: ₺{org.paidAmount.toLocaleString("tr-TR")}</span>
            {remaining > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">Kalan: ₺{remaining.toLocaleString("tr-TR")}</span>}
            {remaining <= 0 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Tamamı ödendi</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
