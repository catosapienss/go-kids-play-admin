"use client"

import { useState } from "react"
import {
  LayoutDashboard, TrendingUp, Activity, Users, Cake, ShieldCheck, ShoppingBag, Baby,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MainLayout } from "@/components/layout/main-layout"
import { DateRangeProvider } from "@/lib/reports/date-range-context"
import { DateRangePicker } from "@/components/raporlar/date-range-picker"

import { RevenuePeriodCards }     from "@/components/raporlar/revenue-period-cards"
import { RevenueMixDonut }        from "@/components/raporlar/revenue-mix-donut"
import { PeakHoursHeatmap }       from "@/components/raporlar/peak-hours-heatmap"
import { PackagePerformancePanel } from "@/components/raporlar/package-performance-panel"
import { CustomerInsightsPanel }  from "@/components/raporlar/customer-insights-panel"
import { OrgAnalyticsPanel }      from "@/components/raporlar/org-analytics-panel"
import { StaffPerformancePanel }  from "@/components/raporlar/staff-performance-panel"
import { DayEndPanel }            from "@/components/raporlar/day-end-panel"
import { RecentTransactionsPanel } from "@/components/raporlar/recent-transactions-panel"
import { DiscountsPanel } from "@/components/raporlar/discounts-panel"
import { RetailDiscountsPanel } from "@/components/raporlar/retail-discounts-panel"
import { DailyNotesReportPanel } from "@/components/raporlar/daily-notes-report-panel"
import { RetailReportPanel } from "@/components/raporlar/retail-report-panel"
import { WasteReportPanel } from "@/components/raporlar/waste-report-panel"
import { AttendanceAnalyticsPanel } from "@/components/raporlar/attendance-analytics-panel"
import { RevenueTrafficPanel } from "@/components/raporlar/revenue-traffic-panel"

// ─── /raporlar — Advanced Reporting & Business Insights ──────────────────────
//
// Multi-section analytics workspace driven by a single global DateRangePicker.
// Tabs scope what's visible without losing the date filter when switching:
//
//   • Genel    — high-level period KPIs + revenue trend
//   • Gelir    — payment-method breakdown + peak hours
//   • Müşteri  — returning rate, VIP ratio, top spenders
//   • Operasyon — packages, organisations, staff performance
//
// All panels accept range from `useDateRange()` so the picker rules the page.

type Tab = "overview" | "attendance" | "revenue" | "retail" | "customer" | "ops"

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview",   label: "Genel Bakış",  icon: LayoutDashboard },
  { id: "attendance", label: "Katılım",      icon: Baby },
  { id: "revenue",    label: "Gelir",        icon: TrendingUp },
  { id: "retail",     label: "Perakende",    icon: ShoppingBag },
  { id: "customer",   label: "Müşteri",      icon: Users },
  { id: "ops",        label: "Operasyon",    icon: Activity },
]

export default function RaporlarPage() {
  const [tab, setTab] = useState<Tab>("overview")

  return (
    <DateRangeProvider initialPreset="last7">
      <MainLayout title="Raporlar" subtitle="İş zekâsı · finans · operasyon analitiği">
        <div className="max-w-[1600px] mx-auto space-y-5">

          {/* Filter bar — sticky-ish, applies to every panel below */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <nav className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 p-1 overflow-x-auto">
              {TABS.map((t) => {
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors",
                      active
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                    )}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                )
              })}
            </nav>
            <div className="sm:ml-auto">
              <DateRangePicker />
            </div>
          </div>

          {/* Period cards always visible — top-line headline KPIs */}
          <RevenuePeriodCards />

          {/* Tab content */}
          {tab === "overview" && (
            <div className="space-y-5">
              <RevenueMixDonut />
              <RecentTransactionsPanel />
              <DiscountsPanel limit={50} />
              <RetailDiscountsPanel limit={50} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <CustomerInsightsPanel />
                <StaffPerformancePanel />
              </div>
              <DayEndPanel />
            </div>
          )}

          {tab === "attendance" && (
            <div className="space-y-5">
              <AttendanceAnalyticsPanel />
              <RevenueTrafficPanel />
              <PeakHoursHeatmap />
            </div>
          )}

          {tab === "revenue" && (
            <div className="space-y-5">
              <RevenueMixDonut />
              <RecentTransactionsPanel limit={100} />
              <DiscountsPanel limit={100} />
              <RetailDiscountsPanel limit={100} />
              <PeakHoursHeatmap />
              <DayEndPanel />
            </div>
          )}

          {tab === "retail" && (
            <div className="space-y-5">
              <RetailReportPanel />
              <WasteReportPanel />
              <RetailDiscountsPanel limit={100} />
            </div>
          )}

          {tab === "customer" && (
            <div className="space-y-5">
              <CustomerInsightsPanel />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <OrgAnalyticsPanel />
                <PackagePerformancePanel />
              </div>
            </div>
          )}

          {tab === "ops" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <PackagePerformancePanel />
                <OrgAnalyticsPanel />
              </div>
              <PeakHoursHeatmap />
              <StaffPerformancePanel />
              <DailyNotesReportPanel />
            </div>
          )}
        </div>
      </MainLayout>
    </DateRangeProvider>
  )
}
