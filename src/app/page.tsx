"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { KpiBar } from "@/components/dashboard/kpi-bar"
import { LiveOperationsPanel } from "@/components/dashboard/live-operations-panel"
import {
  DailyRevenueChart,
  HourlyDensityChart,
  PaymentSplitPanel,
} from "@/components/dashboard/revenue-analytics"
import { StaffAnalyticsPanel } from "@/components/dashboard/staff-analytics"
import { PopularPackagesPanel } from "@/components/dashboard/popular-packages"
import { EventSummaryPanel } from "@/components/dashboard/event-summary-panel"
import { RepeatVisitorsPanel } from "@/components/dashboard/repeat-visitors-panel"
import { MembershipsAnalyticsPanel } from "@/components/uyelikler/memberships-analytics-panel"
import { OwnerRevenuePanel } from "@/components/dashboard/owner-revenue-panel"

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })

  return (
    <MainLayout title="Yönetici Paneli" subtitle={today}>
      <div className="space-y-5 max-w-[1600px] mx-auto">
        {/* 1. KPI strip (top metrics) */}
        <section>
          <KpiBar />
        </section>

        {/* 1b. Owner revenue overview — gated by hasModuleAccess(user, "finance") */}
        <section>
          <OwnerRevenuePanel />
        </section>

        {/* 2. Live operations + Revenue trend (primary row) */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-1">
            <LiveOperationsPanel />
          </div>
          <div className="xl:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-5 content-start">
            <DailyRevenueChart />
            <PaymentSplitPanel />
            <div className="lg:col-span-2">
              <HourlyDensityChart />
            </div>
          </div>
        </section>

        {/* 3. Staff + Packages + Events (secondary row) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <StaffAnalyticsPanel />
          <PopularPackagesPanel />
          <EventSummaryPanel />
        </section>

        {/* 4. Membership insight — KPI strip */}
        <section>
          <MembershipsAnalyticsPanel compact />
        </section>

        {/* 5. Customer insight — returning families */}
        <section>
          <RepeatVisitorsPanel />
        </section>
      </div>
    </MainLayout>
  )
}
