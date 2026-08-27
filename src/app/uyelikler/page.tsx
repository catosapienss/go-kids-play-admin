"use client"

import { useState } from "react"
import { Plus, Settings } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { useAuth } from "@/contexts/auth-context"
import { MembershipsAnalyticsPanel } from "@/components/uyelikler/memberships-analytics-panel"
import { MembershipsListPanel } from "@/components/uyelikler/memberships-list-panel"
import { MembershipPackageSaleDialog } from "@/components/uyelikler/membership-package-sale-dialog"
import { MembershipAdminSettings } from "@/components/uyelikler/membership-admin-settings"
import { MembershipCampaignReportPanel } from "@/components/uyelikler/membership-campaign-report-panel"
import { PersonalEntitlementPanel } from "@/components/uyelikler/personal-entitlement-panel"

// ─── /uyelikler — Membership Management ──────────────────────────────────────
//
// Single-screen workspace: KPI strip on top, full list below. Branch-scoped
// via the existing RLS pattern; super_admin sees aggregated counts when in
// "All branches" mode. The "Aylık Üyelik Sat" action sells the configurable
// monthly packages (single / sibling) via migration 035's sell_membership RPC.

export default function MembershipsPage() {
  const { user } = useAuth()
  const isOwner = user?.role === "admin" || user?.role === "super_admin"
  const [saleOpen, setSaleOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <MainLayout
      title="Üyelikler"
      subtitle="Aktif aboneler · duraklatma · kullanım hakları"
    >
      <div className="max-w-[1400px] mx-auto space-y-5">
        <div className="flex justify-end gap-2">
          {isOwner && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-bold"
            >
              <Settings className="w-4 h-4" /> Paket & Kampanya
            </button>
          )}
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
          <MembershipCampaignReportPanel key={`r${refreshKey}`} />
        </section>
        <section>
          <PersonalEntitlementPanel key={`p${refreshKey}`} />
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
      {isOwner && (
        <MembershipAdminSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}
    </MainLayout>
  )
}
