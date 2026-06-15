import { Activity, UserCheck, StickyNote, AlertCircle } from "lucide-react"
import type { Organization } from "@/types/organizasyon"

export function OperationsSection({ org }: { org: Organization }) {
  return (
    <div className="space-y-4">
      {/* Responsible staff */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <UserCheck className="w-4 h-4 text-violet-500" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Sorumlu Personel</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
            {org.responsibleStaff.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{org.responsibleStaff}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ana Sorumlu</p>
          </div>
        </div>
      </div>

      {/* Notes */}
      {(org.notes || org.specialRequests) && (
        <div className="space-y-3">
          {org.notes && (
            <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="w-4 h-4 text-amber-600" />
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Notlar</p>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-300">{org.notes}</p>
            </div>
          )}
          {org.specialRequests && (
            <div className="bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-violet-600" />
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide">Özel İstekler</p>
              </div>
              <p className="text-sm text-violet-800 dark:text-violet-300">{org.specialRequests}</p>
            </div>
          )}
        </div>
      )}

      {/* Operation logs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Operasyon Logu</p>
        </div>
        {org.operationLogs.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-400">Log kaydı yok</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {org.operationLogs.map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Activity className="w-3 h-3 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{log.action}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{log.staffName} · {log.date.split(" ")[0].slice(5).replace("-", "/")} {log.date.split(" ")[1]}</p>
                  {log.note && <p className="text-xs text-slate-500 mt-0.5">{log.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
