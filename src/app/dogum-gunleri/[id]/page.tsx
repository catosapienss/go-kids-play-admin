"use client"

import { notFound } from "next/navigation"
import { useState } from "react"
import { Package, Users, CreditCard, GitBranch, Activity, Info } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { OrgDetailHeader } from "@/components/dogum-gunleri/detail/org-detail-header"
import { PackageManager } from "@/components/dogum-gunleri/detail/package-manager"
import { ChildrenManager } from "@/components/dogum-gunleri/detail/children-manager"
import { PaymentSection } from "@/components/dogum-gunleri/detail/payment-section"
import { TimelineSection } from "@/components/dogum-gunleri/detail/timeline-section"
import { OperationsSection } from "@/components/dogum-gunleri/detail/operations-section"
import { getOrgById } from "@/lib/organizasyon-data"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "info", label: "Organizasyon", icon: Info },
  { id: "package", label: "Paket", icon: Package },
  { id: "children", label: "Çocuklar", icon: Users },
  { id: "payment", label: "Ödeme", icon: CreditCard },
  { id: "timeline", label: "Akış", icon: GitBranch },
  { id: "operations", label: "Operasyon", icon: Activity },
]

export default function OrgDetailPage({ params }: { params: { id: string } }) {
  const org = getOrgById(params.id)
  if (!org) notFound()

  const [activeTab, setActiveTab] = useState("info")

  return (
    <MainLayout title={org.name} subtitle="Organizasyon Detayı">
      <div className="max-w-2xl mx-auto space-y-0">
        {/* Header (includes its own back nav) */}
        <div className="px-4 pt-4">
          <OrgDetailHeader org={org} />
        </div>

        {/* Tabs */}
        <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 mt-4">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors flex-shrink-0",
                    isActive
                      ? "border-violet-600 text-violet-600 dark:text-violet-400 dark:border-violet-400"
                      : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="px-4 py-4">
          {activeTab === "info" && <OrgInfoSection org={org} />}
          {activeTab === "package" && <PackageManager org={org} />}
          {activeTab === "children" && <ChildrenManager org={org} />}
          {activeTab === "payment" && <PaymentSection org={org} />}
          {activeTab === "timeline" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <TimelineSection org={org} />
            </div>
          )}
          {activeTab === "operations" && <OperationsSection org={org} />}
        </div>
      </div>
    </MainLayout>
  )
}

function OrgInfoSection({ org }: { org: ReturnType<typeof getOrgById> }) {
  if (!org) return null

  const rows: { label: string; value: string }[] = [
    { label: "Organizasyon Adı", value: org.name },
    { label: "Veli Adı", value: org.parentName },
    { label: "Telefon", value: org.parentPhone },
    { label: "Çocuk Adı", value: org.childName },
    { label: "Yaş", value: `${org.childAge} yaş` },
    { label: "Tarih", value: org.date },
    { label: "Saat", value: `${org.startTime} – ${org.endTime}` },
    { label: "Katılımcı Sayısı", value: `${org.childCount} çocuk` },
  ]

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3 gap-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">{row.label}</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {org.decorTheme && (
        <div className="bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded-2xl p-4">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide mb-1">Dekorasyon Teması</p>
          <p className="text-sm text-violet-800 dark:text-violet-300">{org.decorTheme}</p>
        </div>
      )}
    </div>
  )
}
