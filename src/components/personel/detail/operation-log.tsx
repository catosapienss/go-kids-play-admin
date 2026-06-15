import { ArrowUpRight, ArrowDownLeft, XCircle, LogIn, LogOut, Wallet, Calendar, Clock, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StaffMember, OpType } from "@/types/personel"

const OP_META: Record<OpType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  payment: { icon: ArrowUpRight, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10", label: "Ödeme" },
  refund: { icon: ArrowDownLeft, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-500/10", label: "İade" },
  cancel: { icon: XCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/10", label: "İptal" },
  checkin: { icon: LogIn, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-500/10", label: "Giriş" },
  checkout: { icon: LogOut, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800", label: "Çıkış" },
  org_action: { icon: Calendar, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/10", label: "Organizasyon" },
  wallet_load: { icon: Wallet, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-500/10", label: "Cüzdan" },
  extend: { icon: Clock, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-500/10", label: "Uzatma" },
}

export function OperationLog({ staff }: { staff: StaffMember }) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Toplam", value: staff.operations.length, color: "text-slate-900 dark:text-white", icon: Zap },
          { label: "Ödeme", value: staff.operations.filter((o) => o.type === "payment").length, color: "text-emerald-600 dark:text-emerald-400", icon: ArrowUpRight },
          { label: "İptal", value: staff.operations.filter((o) => o.type === "cancel").length, color: "text-rose-600 dark:text-rose-400", icon: XCircle },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm text-center">
              <Icon className={cn("w-4 h-4 mx-auto mb-1", s.color)} />
              <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
              <p className="text-[10px] text-slate-400">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">İşlem Geçmişi</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {staff.operations.map((op, idx) => {
            const meta = OP_META[op.type]
            const Icon = meta.icon
            const isLast = idx === staff.operations.length - 1

            return (
              <div key={op.id} className="flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                {/* Icon + line */}
                <div className="flex flex-col items-center">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", meta.bg)}>
                    <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-slate-100 dark:bg-slate-800 mt-1 min-h-[12px]" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", meta.bg, meta.color)}>
                          {meta.label}
                        </span>
                        {op.customerName && (
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">{op.customerName}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{op.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {op.amount && (
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          ₺{op.amount.toLocaleString("tr-TR")}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400">{op.datetime.split(" ")[1]}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
