"use client"

import { notFound } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, User, TrendingUp, ClipboardList, Shield, StickyNote } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { ProfileCard } from "@/components/personel/detail/profile-card"
import { PerformanceStats } from "@/components/personel/detail/performance-stats"
import { OperationLog } from "@/components/personel/detail/operation-log"
import { SecurityLogs } from "@/components/personel/detail/security-logs"
import { StaffNotes } from "@/components/personel/detail/staff-notes"
import { getStaffById } from "@/lib/personel-data"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "profile", label: "Profil", icon: User },
  { id: "performance", label: "Performans", icon: TrendingUp },
  { id: "operations", label: "İşlemler", icon: ClipboardList },
  { id: "security", label: "Güvenlik", icon: Shield },
  { id: "notes", label: "Notlar", icon: StickyNote },
]

const STATUS_META = {
  active: { dot: "bg-emerald-400", label: "Aktif", pulse: true },
  break: { dot: "bg-amber-400", label: "Molada", pulse: false },
  offline: { dot: "bg-slate-400", label: "Çevrimdışı", pulse: false },
}

const ROLE_LABEL = { admin: "Admin", manager: "Yönetici", cashier: "Kasiyer" }

export default function StaffDetailPage({ params }: { params: { id: string } }) {
  const staff = getStaffById(params.id)
  if (!staff) notFound()

  const [activeTab, setActiveTab] = useState("profile")
  const status = STATUS_META[staff.status]

  return (
    <MainLayout title={staff.name} subtitle={ROLE_LABEL[staff.role]}>
      <div className="max-w-2xl mx-auto space-y-0">
        {/* Back + status bar */}
        <div className="px-1 pt-1 pb-3 flex items-center justify-between">
          <Link
            href="/personeller"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Personeller
          </Link>
          <div className="flex items-center gap-1.5">
            <div className="relative w-3 h-3 flex items-center justify-center">
              <span className={cn("w-2 h-2 rounded-full", status.dot)} />
              {status.pulse && <span className={cn("absolute w-2 h-2 rounded-full animate-ping opacity-60", status.dot)} />}
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{status.label}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
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
        <div className="pt-4">
          {activeTab === "profile" && <ProfileCard staff={staff} />}
          {activeTab === "performance" && <PerformanceStats staff={staff} />}
          {activeTab === "operations" && <OperationLog staff={staff} />}
          {activeTab === "security" && <SecurityLogs staff={staff} />}
          {activeTab === "notes" && <StaffNotes staff={staff} />}
        </div>
      </div>
    </MainLayout>
  )
}
