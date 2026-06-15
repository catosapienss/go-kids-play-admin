"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { MembershipsAnalyticsPanel } from "@/components/uyelikler/memberships-analytics-panel"
import { MembershipsListPanel } from "@/components/uyelikler/memberships-list-panel"

// ─── /uyelikler — Membership Management ──────────────────────────────────────
//
// Single-screen workspace: KPI strip on top, full list below. Branch-scoped
// via the existing RLS pattern; super_admin sees aggregated counts when in
// "All branches" mode.

export default function MembershipsPage() {
  return (
    <MainLayout
      title="Üyelikler"
      subtitle="Aktif aboneler · duraklatma · kullanım hakları"
    >
      <div className="max-w-[1400px] mx-auto space-y-5">
        <section>
          <MembershipsAnalyticsPanel />
        </section>
        <section>
          <MembershipsListPanel />
        </section>
      </div>
    </MainLayout>
  )
}
