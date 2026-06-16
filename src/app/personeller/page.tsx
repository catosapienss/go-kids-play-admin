"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, UserPlus, Users, Shield, Activity, BarChart2, Clock } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { StaffCard, StaffCardSkeleton } from "@/components/personel/staff-card"
import { PermissionMatrix } from "@/components/personel/permission-matrix"
import { AnalyticsCharts } from "@/components/personel/analytics-charts"
import { STAFF_MEMBERS } from "@/lib/personel-data"
import type { StaffRole, StaffStatus } from "@/types/personel"
import { cn } from "@/lib/utils"
import { ShiftClockCard } from "@/components/personel/shift-clock-card"
import { ActiveStaffPanel } from "@/components/personel/active-staff-panel"
import { RealActivityTimeline } from "@/components/personel/real-activity-timeline"
import { RefundLogsPanel } from "@/components/personel/refund-logs-panel"
import { ProductionAccounts } from "@/components/personel/production-accounts"
import { UserCog } from "lucide-react"

const TABS = [
  { id: "accounts",    label: "Hesaplar", icon: UserCog },
  { id: "shift",       label: "Vardiya",  icon: Clock },
  { id: "activity",    label: "Aktivite", icon: Activity },
  { id: "staff",       label: "Personel", icon: Users },
  { id: "permissions", label: "Yetkiler", icon: Shield },
  { id: "analytics",   label: "Analitik", icon: BarChart2 },
]

const STATUS_META = {
  active: { label: "Aktif", dot: "bg-emerald-400" },
  break: { label: "Mola", dot: "bg-amber-400" },
  offline: { label: "Çevrimdışı", dot: "bg-slate-400" },
}

export default function PersonellerPage() {
  const [activeTab, setActiveTab] = useState("accounts")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all")
  const [statusFilter, setStatusFilter] = useState<StaffStatus | "all">("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  const filtered = useMemo(() => {
    return STAFF_MEMBERS.filter((s) => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
      const matchRole = roleFilter === "all" || s.role === roleFilter
      const matchStatus = statusFilter === "all" || s.status === statusFilter
      return matchSearch && matchRole && matchStatus
    })
  }, [search, roleFilter, statusFilter])

  const activeCount = STAFF_MEMBERS.filter((s) => s.status === "active").length
  const totalRevenue = STAFF_MEMBERS.reduce((s, p) => s + p.todayRevenue, 0)
  const totalTx = STAFF_MEMBERS.reduce((s, p) => s + p.todayTxCount, 0)

  return (
    <MainLayout title="Personeller" subtitle="Operasyon & Yetki Yönetimi">
      <div className="space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Toplam Personel", value: STAFF_MEMBERS.length, suffix: "kişi", color: "text-slate-900 dark:text-white" },
            { label: "Aktif", value: activeCount, suffix: "online", color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Bugünkü İşlem", value: totalTx, suffix: "adet", color: "text-violet-600 dark:text-violet-400" },
            { label: "Bugünkü Gelir", value: `₺${(totalRevenue / 1000).toFixed(1)}k`, suffix: "", color: "text-sky-600 dark:text-sky-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{s.label}</p>
              <p className={cn("text-2xl font-bold tabular-nums", s.color)}>
                {s.value}
                {s.suffix && <span className="text-sm font-normal ml-1 text-slate-400">{s.suffix}</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Main card with tabs */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Tab nav */}
          <div className="flex border-b border-slate-100 dark:border-slate-800">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors",
                    isActive
                      ? "border-violet-600 text-violet-600 dark:text-violet-400 dark:border-violet-400"
                      : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Accounts tab — real Supabase-backed user management */}
          {activeTab === "accounts" && (
            <div className="p-4">
              <ProductionAccounts />
            </div>
          )}

          {/* Staff tab */}
          {activeTab === "staff" && (
            <div className="p-4 space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Personel ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as StaffRole | "all")}
                    className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-700 dark:text-slate-300"
                  >
                    <option value="all">Tüm Roller</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Yönetici</option>
                    <option value="cashier">Kasiyer</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StaffStatus | "all")}
                    className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-700 dark:text-slate-300"
                  >
                    <option value="all">Tüm Durumlar</option>
                    {(Object.keys(STATUS_META) as StaffStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                  <button className="flex items-center gap-1.5 px-3 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm whitespace-nowrap">
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Ekle</span>
                  </button>
                </div>
              </div>

              {/* Staff grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {loading
                  ? [1, 2, 3, 4].map((i) => <StaffCardSkeleton key={i} />)
                  : filtered.map((staff) => <StaffCard key={staff.id} staff={staff} />)
                }
              </div>

              {!loading && filtered.length === 0 && (
                <div className="py-12 text-center">
                  <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Personel bulunamadı</p>
                </div>
              )}
            </div>
          )}

          {/* Vardiya tab — operational primary */}
          {activeTab === "shift" && (
            <div className="p-4 space-y-4">
              <ShiftClockCard />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ActiveStaffPanel />
                <RefundLogsPanel />
              </div>
            </div>
          )}

          {/* Activity tab — live audit feed */}
          {activeTab === "activity" && (
            <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 min-h-[600px]">
                <RealActivityTimeline limit={50} className="h-full" />
              </div>
              <div className="lg:col-span-1 space-y-4">
                <ActiveStaffPanel />
                <RefundLogsPanel />
              </div>
            </div>
          )}

          {/* Permissions tab */}
          {activeTab === "permissions" && (
            <div className="p-4">
              <PermissionMatrix />
            </div>
          )}

          {/* Analytics tab */}
          {activeTab === "analytics" && (
            <div className="p-4">
              <AnalyticsCharts staff={STAFF_MEMBERS} />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
