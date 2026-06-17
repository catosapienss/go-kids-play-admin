"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Search, Plus, X } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { OrgStatsBar } from "@/components/dogum-gunleri/org-stats-bar"
import { MiniCalendar } from "@/components/dogum-gunleri/mini-calendar"
import { UpcomingEvents } from "@/components/dogum-gunleri/upcoming-events"
import { OrgList } from "@/components/dogum-gunleri/org-list"
import { BirthdayPackageManager } from "@/components/dogum-gunleri/package-manager"
import { NewOrganizationModal } from "@/components/dogum-gunleri/new-organization-modal"
import { listOrganizations, type OrganizationRow } from "@/lib/services/organizations.service"
import type { Organization, OrgStatus } from "@/types/organizasyon"
import { cn } from "@/lib/utils"

const STATUS_FILTERS: { key: OrgStatus | "all"; label: string; active: string }[] = [
  { key: "all", label: "Tümü", active: "bg-violet-600 text-white" },
  { key: "upcoming", label: "Yaklaşıyor", active: "bg-sky-500 text-white" },
  { key: "ongoing", label: "Devam Ediyor", active: "bg-emerald-500 text-white" },
  { key: "completed", label: "Tamamlandı", active: "bg-slate-600 text-white" },
  { key: "cancelled", label: "İptal", active: "bg-red-500 text-white" },
]

// Map Supabase organization row to the legacy Organization shape used by
// the existing UI components (OrgList, MiniCalendar, UpcomingEvents).
function rowToOrganization(r: OrganizationRow): Organization {
  return {
    id: r.id,
    name: r.child_name ? `${r.child_name} doğum günü` : "Doğum günü",
    childName: r.child_name,
    childAge: r.child_age ?? 0,
    parentName: r.parent_name,
    parentPhone: r.parent_phone ?? "",
    date: r.event_date,
    time: r.event_time ?? "",
    guestCount: r.guest_count,
    packageId: r.package_id ?? "",
    revenue: Number(r.total_price ?? 0),
    status: r.status as Organization["status"],
    notes: r.notes ?? "",
    paymentReceived: 0,
    paymentTotal: Number(r.total_price ?? 0),
    extras: [],
  }
}

export default function DogumGunleriPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<OrgStatus | "all">("all")
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [showNew, setShowNew] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])

  const reload = useCallback(async () => {
    try {
      const rows = await listOrganizations()
      setOrganizations(rows.map(rowToOrganization))
    } catch (e) {
      console.warn("[/dogum-gunleri] load failed", e)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const filtered = useMemo(() => {
    let list = [...organizations]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.childName.toLowerCase().includes(q) ||
          o.parentName.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      list = list.filter((o) => o.status === statusFilter)
    }

    if (selectedDate) {
      list = list.filter((o) => o.date === selectedDate)
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [search, statusFilter, selectedDate])

  return (
    <MainLayout title="Doğum Günleri" subtitle="Organizasyon & Etkinlik Yönetimi">
      <BirthdayPackageManager />

      <OrgStatsBar orgs={organizations} />

      <div className="flex flex-col xl:flex-row gap-5">
        {/* Left sidebar: calendar + upcoming */}
        <div className="xl:w-72 flex-shrink-0 space-y-4">
          <MiniCalendar
            organizations={organizations}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(selectedDate === d ? undefined : d)}
          />
          <UpcomingEvents organizations={organizations} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Organizasyon, çocuk, veli..."
                className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-slate-900 dark:text-white"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            {selectedDate && (
              <button
                onClick={() => setSelectedDate(undefined)}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 rounded-xl text-xs font-semibold"
              >
                <X className="w-3.5 h-3.5" />
                {selectedDate.slice(5).replace("-", "/")}
              </button>
            )}

            <button
              onClick={() => setShowNew(true)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-violet-500/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Yeni Organizasyon</span>
            </button>
          </div>

          {showNew && (
            <NewOrganizationModal
              onClose={() => setShowNew(false)}
              onCreated={() => void reload()}
            />
          )}

          {/* Status filters */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {STATUS_FILTERS.map(({ key, label, active }) => {
              const isActive = statusFilter === key
              const count = key === "all" ? organizations.length : organizations.filter((o) => o.status === key).length
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
                    isActive
                      ? `${active} shadow-sm`
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  {label}
                  <span className={cn(
                    "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                    isActive ? "bg-white/25 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Result count */}
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
            <span className="font-semibold text-slate-900 dark:text-white">{filtered.length}</span> organizasyon
          </p>

          {/* List */}
          <OrgList organizations={filtered} />
        </div>
      </div>
    </MainLayout>
  )
}
