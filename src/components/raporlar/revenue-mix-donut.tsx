"use client"

import { useEffect, useMemo, useState } from "react"
import { PieChart, Pie, Cell, Tooltip } from "recharts"
import { getRevenueByCategory } from "@/lib/services/reports.service"
import { resolvePreset, type RevenueByCategory, type TenderSplit } from "@/types/reports"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { EmptyState } from "@/components/system/empty-state"

// ─── Gelir Dağılımı — category revenue donut ─────────────────────────────────
//
// Business-category revenue mix: Oyun Seansları / Perakende / Üyelikler /
// Doğum Günleri, plus a Nakit / Kart tender strip. Data comes from ONE server
// RPC (revenue_by_category, migrations 037 + 038) whose slices each mirror the
// matching report tab's own figure — the legend, tooltip and chart therefore
// always share a single source of truth. Amounts are shown in full ₺.
//
// This card is deliberately PINNED TO TODAY: it is the "how did today go right
// now" panel, so it ignores the page's DateRangePicker and always resolves the
// `today` preset itself. Every other panel still follows the picker.

// Full Turkish currency — no abbreviation (₺14.280, not 14,2K).
function fmtTRY(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

// Turkish percentage with one decimal and comma separator (%66,4).
function fmtPct(part: number, total: number): string {
  if (total <= 0) return "%0"
  const p = (part / total) * 100
  return `%${p.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
}

type CategoryKey = "sessions" | "retail" | "memberships" | "birthdays"
type Slice = { key: CategoryKey; name: string; value: number; color: string; tender: TenderSplit }

// Tender rows under the donut. `other` covers money we know was collected but
// cannot attribute to a tender (doğum günü kayıtlarında ödeme tipi tutulmuyor,
// karma üyelik satışının oranı geri alınamıyor) — it is only rendered when > 0
// so the common nakit/kart case stays a clean two-row strip.
const TENDER_META: { key: keyof TenderSplit; name: string; color: string }[] = [
  { key: "cash",   name: "Nakit",  color: "#10b981" }, // emerald-500
  { key: "card",   name: "Kart",   color: "#3b82f6" }, // blue-500
  { key: "wallet", name: "Cüzdan", color: "#a855f7" }, // purple-500
  { key: "other",  name: "Diğer",  color: "#94a3b8" }, // slate-400
]

// Oyun Seansları carries the brand violet (primary); the rest use lighter,
// compatible hues so the accent stays the hero while remaining distinguishable.
// Solid tokens (no gradients) — the same category colours the dashboard uses.
const SLICE_META: { key: Slice["key"]; name: string; color: string }[] = [
  { key: "sessions",    name: "Oyun Seansları", color: "#7c3aed" }, // violet-600 (accent)
  { key: "retail",      name: "Perakende",      color: "#0ea5e9" }, // sky-500
  { key: "memberships", name: "Üyelikler",      color: "#f59e0b" }, // amber-500
  { key: "birthdays",   name: "Doğum Günleri",  color: "#ec4899" }, // pink-500
]

export function RevenueMixDonut() {
  const [data, setData] = useState<RevenueByCategory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reconnectToken = useReconnectToken()

  // Always today — recomputed when the calendar day flips (a panel left open
  // overnight rolls over on its next reconnect tick) instead of being frozen
  // at mount.
  const dayKey = new Date().toDateString()
  const range = useMemo(() => resolvePreset("today"), [dayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    void getRevenueByCategory(range)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [range, reconnectToken])

  const subtitle = "Bugün"

  const slices = useMemo<Slice[]>(() => {
    if (!data) return []
    return SLICE_META
      .map((m) => ({ ...m, value: data[m.key], tender: data.tenderBy[m.key] }))
      .filter((s) => s.value > 0)
  }, [data])

  const tenderRows = useMemo(() => {
    if (!data || !data.hasTenderSplit) return []
    return TENDER_META
      .map((m) => ({ ...m, value: data.tender[m.key] }))
      .filter((t) => t.value > 0)
  }, [data])

  if (!data && !error) return <PanelSkeleton height={280} />
  if (error) return <EmptyState title="Gelir verisi okunamadı" body={error} tone="danger" />
  if (!data || data.total <= 0 || slices.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
        <Header subtitle={subtitle} />
        <div className="mt-4">
          <EmptyState title="Bu aralıkta gelir kaydı yok" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
      <Header subtitle={subtitle} />

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Donut — fixed 200×200 so the arc never collapses to a sliver
            (recharts ResponsiveContainer can measure 0 width inside a flex row
            during the first paint). Responsiveness is handled by the flex layout
            stacking the fixed donut above the legend on narrow screens. */}
        <div className="relative w-[200px] h-[200px] shrink-0 mx-auto sm:mx-0">
          <PieChart width={200} height={200}>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx={100}
              cy={100}
              innerRadius={62}
              outerRadius={92}
              paddingAngle={slices.length > 1 ? 2 : 0}
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
            </Pie>
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null
                const p = payload[0].payload as Slice
                return (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                      <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                      {p.name}
                    </div>
                    <div className="mt-0.5 font-black tabular-nums text-slate-900 dark:text-white">{fmtTRY(p.value)}</div>
                    <div className="text-slate-500 dark:text-slate-400 tabular-nums">{fmtPct(p.value, data.total)}</div>
                    {/* Nakit/kart kırılımı — sadece bilinen tenderlar */}
                    {data.hasTenderSplit && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                      {TENDER_META.filter((m) => p.tender[m.key] > 0).map((m) => (
                        <div key={m.key} className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
                          <span>{m.name}</span>
                          <span className="ml-auto tabular-nums font-bold text-slate-700 dark:text-slate-200">
                            {fmtTRY(p.tender[m.key])}
                          </span>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                )
              }}
            />
          </PieChart>
          {/* Center total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Toplam</span>
            <span className="text-lg font-black tabular-nums text-slate-900 dark:text-white leading-tight">{fmtTRY(data.total)}</span>
          </div>
        </div>

        {/* Legend */}
        <ul className="flex-1 space-y-1.5 min-w-0">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{s.name}</span>
              <span className="ml-auto text-[11px] tabular-nums text-slate-400 dark:text-slate-500">{fmtPct(s.value, data.total)}</span>
              <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white w-24 text-right">{fmtTRY(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Nakit / Kart şeridi — aynı toplamın ödeme tipine göre dağılımı */}
      {tenderRows.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
            Ödeme Tipi
          </p>
          <div className="mt-2.5 flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            {tenderRows.map((t) => (
              <span
                key={t.key}
                className="h-full"
                style={{ background: t.color, width: `${(t.value / data.total) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
            {tenderRows.map((t) => (
              <div key={t.key} className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{t.name}</span>
                <span className="ml-auto text-right">
                  <span className="block text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {fmtTRY(t.value)}
                  </span>
                  <span className="block text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                    {fmtPct(t.value, data.total)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Gelir Dağılımı</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
    </div>
  )
}
