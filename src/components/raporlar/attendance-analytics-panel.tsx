"use client"

import { useEffect, useState } from "react"
import { Baby, Users, Repeat, Sparkles, TrendingUp, Clock, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumberTR } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { getAttendanceAnalytics, type AttendanceAnalytics } from "@/lib/services/reports.service"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"

// ─── Child Attendance Analytics (Reports) ────────────────────────────────────
//
// One source of truth: `sessions` = child entries, TR-local calendar days
// (00:00 rollover). Parents, retail, and session extensions are never counted.

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", weekday: "short" }) }
  catch { return iso }
}
function hourLabel(h: number): string { return `${String(h).padStart(2, "0")}:00` }

export function AttendanceAnalyticsPanel() {
  const { range } = useDateRange()
  const [data, setData] = useState<AttendanceAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setData(null); setError(null)
    void getAttendanceAnalytics(range)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [range, reconnectToken])

  if (!data && !error) return <PanelSkeleton height={420} />
  if (error) return <EmptyState title="Katılım verisi okunamadı" body={error} tone="danger" />
  if (!data) return null

  const hourlyMax = Math.max(1, ...data.hourly.map((h) => h.count))
  const totalWE = data.weekdayEntries + data.weekendEntries

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Baby className="w-3.5 h-3.5 text-sky-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Çocuk Katılımı</h3>
        <span className="text-[10px] text-slate-400 ml-auto">Kaynak: oyun alanı girişleri · TR saati</span>
      </div>

      {/* KPI grid */}
      <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-slate-100 dark:border-slate-800">
        <Kpi icon={Baby} tone="sky" label="Toplam Çocuk Girişi" value={formatNumberTR(data.totalEntries)} hint={`${data.activeDays} aktif gün`} />
        <Kpi icon={Users} tone="violet" label="Benzersiz Çocuk" value={formatNumberTR(data.uniqueChildren)} hint="farklı çocuk" />
        <Kpi icon={Repeat} tone="emerald" label="Tekrar Gelen" value={formatNumberTR(data.returningChildren)} hint="daha önce gelmiş" />
        <Kpi icon={Sparkles} tone="amber" label="İlk Kez Gelen" value={formatNumberTR(data.firstTimeChildren)} hint="ilk ziyareti" />
      </div>

      {/* Secondary metrics */}
      <div className="px-5 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-slate-100 dark:border-slate-800 text-sm">
        <Metric icon={TrendingUp} label="Günlük Ortalama" value={`${data.avgPerDay}`} sub="çocuk / gün" />
        <Metric icon={Calendar} label="En Yoğun Gün" value={data.busiestDay ? fmtDate(data.busiestDay.date) : "—"} sub={data.busiestDay ? `${data.busiestDay.count} çocuk` : ""} />
        <Metric icon={Clock} label="En Yoğun Saat" value={data.busiestHour ? hourLabel(data.busiestHour.hour) : "—"} sub={data.busiestHour ? `${data.busiestHour.count} çocuk` : ""} />
        <Metric icon={Calendar} label="En Sakin Gün" value={data.lowestDay ? fmtDate(data.lowestDay.date) : "—"} sub={data.lowestDay ? `${data.lowestDay.count} çocuk` : ""} />
      </div>

      {/* Weekday vs weekend */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2">Hafta İçi ↔ Hafta Sonu</h4>
        <div className="flex h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
          {totalWE > 0 ? (
            <>
              <div className="bg-sky-500 flex items-center justify-center text-[11px] font-bold text-white" style={{ width: `${(data.weekdayEntries / totalWE) * 100}%` }}>
                {data.weekdayEntries > 0 && `${data.weekdayEntries}`}
              </div>
              <div className="bg-amber-500 flex items-center justify-center text-[11px] font-bold text-white" style={{ width: `${(data.weekendEntries / totalWE) * 100}%` }}>
                {data.weekendEntries > 0 && `${data.weekendEntries}`}
              </div>
            </>
          ) : <div className="w-full flex items-center justify-center text-[11px] text-slate-400">Veri yok</div>}
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> Hafta içi: <strong>{formatNumberTR(data.weekdayEntries)}</strong></span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Hafta sonu: <strong>{formatNumberTR(data.weekendEntries)}</strong></span>
        </div>
      </div>

      {/* Hourly distribution */}
      <div className="px-5 py-4">
        <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-3">Saatlik Dağılım</h4>
        {data.totalEntries === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Bu aralıkta giriş yok</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.hourly.filter((h) => h.hour >= 8 && h.hour <= 22).map((h) => (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">{h.count}</span>
                <div className="w-full rounded-t bg-gradient-to-t from-sky-500 to-sky-400 transition-all" style={{ height: `${Math.max(2, (h.count / hourlyMax) * 100)}%` }} title={`${hourLabel(h.hour)} · ${h.count} çocuk`} />
                <span className="text-[8px] text-slate-400 tabular-nums">{String(h.hour).padStart(2, "0")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const TONE: Record<string, string> = {
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
}

function Kpi({ icon: Icon, tone, label, value, hint }: {
  icon: typeof Baby; tone: keyof typeof TONE; label: string; value: string; hint: string
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", TONE[tone])}><Icon className="w-3.5 h-3.5" /></div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
    </div>
  )
}

function Metric({ icon: Icon, label, value, sub }: { icon: typeof Clock; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1"><Icon className="w-3 h-3" />{label}</p>
      <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}
