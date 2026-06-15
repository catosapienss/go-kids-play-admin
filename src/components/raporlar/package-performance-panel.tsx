"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts"
import { Package, Repeat, Sparkles, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/lib/reports/date-range-context"
import { getPackagePerformance } from "@/lib/services/reports.service"
import { type PackagePerformance } from "@/types/reports"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"

// ─── Package Performance Panel ────────────────────────────────────────────────
//
// Bucket chart (30/60/90/Sınırsız) + three KPI tiles:
//   • Sınırsız share (% of all sessions)
//   • Extension rate (% of sessions that got extended)
//   • Average duration (only counts time-bound sessions)
//
// Date-range aware — driven by the global DateRangeProvider.

const BUCKET_COLOR: Record<string, string> = {
  "30dk":     "#3b82f6",  // blue
  "60dk":     "#8b5cf6",  // violet
  "90dk":     "#6366f1",  // indigo
  "Sınırsız": "#ec4899",  // fuchsia/pink — playful (matches brand)
}

export function PackagePerformancePanel() {
  const { range } = useDateRange()
  const [data, setData] = useState<PackagePerformance | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    void getPackagePerformance(range)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [range, reconnectToken])

  if (!data && !error) return <PanelSkeleton height={320} />
  if (error)            return <EmptyState title="Paket verisi okunamadı" body={error} tone="danger" />
  if (!data) return null

  const total = data.buckets.reduce((s, b) => s + b.count, 0)
  const top = data.buckets.reduce((m, b) => (b.count > m.count ? b : m), { bucket: "—", count: 0 })

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Package className="w-3.5 h-3.5 text-violet-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Paket Performansı</h3>
        <span className="text-[11px] text-slate-400 ml-auto tabular-nums">
          {total.toLocaleString("tr-TR")} oturum
        </span>
      </div>

      {/* KPI strip */}
      <div className="p-5 grid grid-cols-3 gap-3 border-b border-slate-100 dark:border-slate-800">
        <Kpi
          label="En Çok Satan"
          value={top.bucket}
          hint={`${top.count} oturum · %${total > 0 ? Math.round((top.count / total) * 100) : 0}`}
          icon={Package}
          tone="violet"
        />
        <Kpi
          label="Uzatma Oranı"
          value={`%${data.extensionRate.toFixed(1)}`}
          hint="süre uzatılan oturumlar"
          icon={Repeat}
          tone="amber"
        />
        <Kpi
          label="Sınırsız Payı"
          value={`%${data.unlimitedShare.toFixed(1)}`}
          hint={`ort. süre ${Math.round(data.avgDuration)} dk`}
          icon={Sparkles}
          tone="fuchsia"
        />
      </div>

      {/* Bar chart */}
      <div className="p-5">
        {data.buckets.length === 0 || total === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Bu aralıkta paket satışı yok.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.buckets}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              barCategoryGap={24}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: 12 }}
                labelStyle={{ fontWeight: 700 }}
                formatter={(v) => [`${Number(v).toLocaleString("tr-TR")} oturum`, "Sayı"]}
                cursor={{ fill: "rgba(139,92,246,0.06)" }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {data.buckets.map((b, i) => (
                  <BarCell key={i} bucket={b.bucket} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function BarCell({ bucket }: { bucket: string }) {
  return <Cell fill={BUCKET_COLOR[bucket] ?? "#8b5cf6"} />
}

// ─── KPI atom (local to this panel — slightly different layout from others) ──

const TONE: Record<string, string> = {
  violet:  "bg-violet-500/10  text-violet-600  dark:text-violet-300",
  amber:   "bg-amber-500/10   text-amber-600   dark:text-amber-300",
  fuchsia: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300",
}

function Kpi({ label, value, hint, icon: Icon, tone }: {
  label: string
  value: string
  hint: string
  icon: typeof Clock
  tone: keyof typeof TONE
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", TONE[tone])}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{hint}</p>
    </div>
  )
}
