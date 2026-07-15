"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { MembershipsAnalyticsPanel } from "@/components/uyelikler/memberships-analytics-panel"
import { MembershipsListPanel } from "@/components/uyelikler/memberships-list-panel"
import { MembershipPackageSaleDialog } from "@/components/uyelikler/membership-package-sale-dialog"

// ─── /uyelikler — Membership Management ──────────────────────────────────────
//
// Single-screen workspace: KPI strip on top, full list below. Branch-scoped
// via the existing RLS pattern; super_admin sees aggregated counts when in
// "All branches" mode. The "Aylık Üyelik Sat" action sells the configurable
// monthly packages (single / sibling) via migration 035's sell_membership RPC.

export default function MembershipsPage() {
  const [saleOpen, setSaleOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <MainLayout
      title="Üyelikler"
      subtitle="Aktif aboneler · duraklatma · kullanım hakları"
    >
      <div className="max-w-[1400px] mx-auto space-y-5">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSaleOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Aylık Üyelik Sat
          </button>
        </div>
        <section>
          <MembershipsAnalyticsPanel key={`a${refreshKey}`} />
        </section>
        <section>
          <MembershipsListPanel key={`l${refreshKey}`} />
        </section>
      </div>

      <MembershipPackageSaleDialog
        open={saleOpen}
        onClose={() => setSaleOpen(false)}
        onCreated={() => { setSaleOpen(false); setRefreshKey((k) => k + 1) }}
      />
    </MainLayout>
  )
}
