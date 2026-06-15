import { LogIn, LogOut, AlertTriangle, ShieldAlert, Settings, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StaffMember, SecurityEvent } from "@/types/personel"

const EVENT_META: Record<SecurityEvent, { icon: React.ElementType; color: string; bg: string; label: string; border: string }> = {
  login: {
    icon: LogIn, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10",
    label: "Giriş", border: "border-emerald-200 dark:border-emerald-500/20",
  },
  logout: {
    icon: LogOut, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800",
    label: "Çıkış", border: "border-slate-200 dark:border-slate-700",
  },
  failed_login: {
    icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/10",
    label: "Başarısız Giriş", border: "border-amber-200 dark:border-amber-500/20",
  },
  suspicious: {
    icon: ShieldAlert, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-500/10",
    label: "Şüpheli İşlem", border: "border-rose-200 dark:border-rose-500/20",
  },
  permission_change: {
    icon: Settings, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-500/10",
    label: "Yetki Değişikliği", border: "border-violet-200 dark:border-violet-500/20",
  },
}

export function SecurityLogs({ staff }: { staff: StaffMember }) {
  const alertCount = staff.securityLogs.filter((l) =>
    l.event === "failed_login" || l.event === "suspicious"
  ).length

  return (
    <div className="space-y-4">
      {/* Alert banner */}
      {alertCount > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {alertCount} güvenlik uyarısı
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              Son 30 gün içinde başarısız giriş veya şüpheli işlem tespit edildi.
            </p>
          </div>
        </div>
      )}

      {/* Device info */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Monitor className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Kayıtlı Cihazlar</p>
        </div>
        <div className="space-y-2">
          {Array.from(new Set(staff.securityLogs.map((l) => l.device))).map((device) => (
            <div key={device} className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{device}</span>
              </div>
              <span className="text-[10px] text-slate-400">Güvenilir</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security log entries */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Güvenlik Kayıtları</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {staff.securityLogs.map((log) => {
            const meta = EVENT_META[log.event]
            const Icon = meta.icon
            const isAlert = log.event === "failed_login" || log.event === "suspicious"

            return (
              <div
                key={log.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-colors",
                  isAlert ? "bg-amber-50/50 dark:bg-amber-500/5" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                )}
              >
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border", meta.bg, meta.border)}>
                  <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", meta.bg, meta.color, meta.border)}>
                      {meta.label}
                    </span>
                    {isAlert && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">⚠ Dikkat</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{log.device}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <code className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {log.ip}
                    </code>
                  </div>
                  {log.note && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">{log.note}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400">{log.datetime.split(" ")[0].slice(5).replace("-", "/")}</p>
                  <p className="text-[10px] text-slate-400">{log.datetime.split(" ")[1]}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
