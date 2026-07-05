"use client"

import { useEffect, useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { listBranchStats, type BranchStatsRow } from "@/lib/services/branch.service"
import { Building2, Users, Activity, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { isSuperAdmin } from "@/types/auth"

// ─── Branches admin page — foundation only ──────────────────────────────────
//
// Lists every branch with today's headline stats. This is the entry point for
// the future "central analytics" dashboard (cross-branch comparison, franchise
// performance, multi-location reporting). For now it's deliberately minimal.

function fmtTRY(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

export default function BranchesPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<BranchStatsRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listBranchStats()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Yüklenemedi"))
  }, [])

  // Defensive UX — non-super-admins should be redirected by RoleGuard, but
  // we still render a clear message if they somehow land here.
  const isAllowed = !!user && isSuperAdmin(user.role)

  return (
    <MainLayout title="Şube Yönetimi" subtitle="Tüm şubeler · merkezi görünüm">
      <div className="max-w-[1400px] mx-auto space-y-5">
        {!isAllowed && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-500/5 px-5 py-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Bu sayfa yalnızca Süper Admin için görünür.
            </p>
          </div>
        )}

        {/* Headline row */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat label="Aktif Şube"     value={rows?.length ?? "—"} tone="violet"  icon={Building2} />
          <Stat label="Toplam Veli"    value={rows?.reduce((s, r) => s + r.parentCount, 0) ?? "—"} tone="blue" icon={Users} />
          <Stat label="Bugün Net Ciro" value={rows ? fmtTRY(rows.reduce((s, r) => s + r.revenueToday, 0)) : "—"} tone="emerald" icon={TrendingUp} />
        </section>

        {/* Branches table */}
        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Şubeler</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Bugünkü performans</p>
            </div>
          </div>

          {error ? (
            <div className="px-5 py-10 text-center text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          ) : !rows ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">Yükleniyor…</div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              Hiç şube tanımlı değil. <span className="text-slate-500">Migration 005&apos;i çalıştırdığından emin ol.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {rows.map((b) => (
                <div key={b.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{b.branchName}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{b.branchCode}</p>
                  </div>
                  <Metric icon={Users}     label="Veli"   value={b.parentCount} />
                  <Metric icon={Activity}  label="Bugün"  value={b.sessionCountToday} />
                  <Metric icon={TrendingUp} label="Ciro"  value={fmtTRY(b.revenueToday)} highlight />
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 px-2">
          🚧 Şube oluşturma, düzenleme ve detay sayfaları sonraki aşamada — bu sayfa şimdilik salt okunur foundation.
        </p>
      </div>
    </MainLayout>
  )
}

// ─── Small inline atoms ──────────────────────────────────────────────────────

function Stat({ label, value, tone, icon: Icon }: {
  label: string
  value: number | string
  tone: "violet" | "blue" | "emerald"
  icon: React.ComponentType<{ className?: string }>
}) {
  const TONES: Record<string, string> = {
    violet:  "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  }
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", TONES[tone])}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, highlight }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  highlight?: boolean
}) {
  return (
    <div className="hidden md:flex flex-col items-end min-w-[80px]">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className={cn(
        "text-sm font-bold tabular-nums",
        highlight ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200",
      )}>
        {value}
      </p>
    </div>
  )
}
