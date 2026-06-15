import { cn } from "@/lib/utils"
import type { OrgStatus, PaymentStatus } from "@/types/organizasyon"

export const STATUS_META: Record<OrgStatus, { label: string; color: string; bg: string; dot: string }> = {
  upcoming: { label: "Yaklaşıyor", color: "text-sky-700 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-500/10", dot: "bg-sky-500" },
  ongoing: { label: "Devam Ediyor", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10", dot: "bg-emerald-500 animate-pulse" },
  completed: { label: "Tamamlandı", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", dot: "bg-slate-400" },
  cancelled: { label: "İptal", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/10", dot: "bg-red-500" },
}

export const PAYMENT_META: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  unpaid: { label: "Ödenmedi", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/10" },
  deposit: { label: "Depozito", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/10" },
  partial: { label: "Kısmi Ödeme", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-500/10" },
  paid: { label: "Ödendi", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10" },
}

export function OrgStatusBadge({ status }: { status: OrgStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold", meta.bg, meta.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", meta.dot)} />
      {meta.label}
    </span>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_META[status]
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold", meta.bg, meta.color)}>
      {meta.label}
    </span>
  )
}
