"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { DayEndClosingCard } from "@/components/gun-sonu/day-end-closing-card"
import { ClosingHistory } from "@/components/gun-sonu/closing-history"
import { DayEndPanel } from "@/components/raporlar/day-end-panel"
import { StaffAnalyticsPanel } from "@/components/dashboard/staff-analytics"
import { PopularPackagesPanel } from "@/components/dashboard/popular-packages"
import { HourlyDensityChart, PaymentSplitPanel } from "@/components/dashboard/revenue-analytics"
import { StaffClosingForm } from "@/components/gun-sonu/staff-closing-form"
import { DailyOperationsNotesSection } from "@/components/gun-sonu/daily-operations-notes-section"
import { useAuth } from "@/contexts/auth-context"
import { isStaffRole } from "@/types/auth"

export default function GunSonuPage() {
  const { user } = useAuth()

  // Staff (personel) sees a simplified closing form only.
  if (user && isStaffRole(user.role)) {
    return (
      <MainLayout
        title="Gün Sonu"
        subtitle="Kasa sayımı · gün sonu teslimi"
      >
        <div className="max-w-xl mx-auto space-y-4">
          <StaffClosingForm />
          <DailyOperationsNotesSection />
        </div>
      </MainLayout>
    )
  }

  // Manager / admin / super_admin gets the full reconciliation view.
  return (
    <MainLayout
      title="Gün Sonu"
      subtitle="Kasa sayımı · mutabakat · kapanış"
    >
      <div className="space-y-5 max-w-[1600px] mx-auto">
        <section>
          <DayEndClosingCard />
        </section>

        <section>
          <DayEndPanel />
        </section>

        {/* Daily operations notes — review shift log before finalising */}
        <section>
          <DailyOperationsNotesSection />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <StaffAnalyticsPanel />
          <PopularPackagesPanel />
          <PaymentSplitPanel />
          <div className="lg:col-span-3">
            <HourlyDensityChart />
          </div>
        </section>

        <section>
          <ClosingHistory />
        </section>
      </div>
    </MainLayout>
  )
}
