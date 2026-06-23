"use client"

import { useState } from "react"
import {
  Settings as SettingsIcon, Package, ShieldCheck, Tv, CreditCard, Bell, Users, Printer, Zap,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MainLayout } from "@/components/layout/main-layout"
import {
  SECTION_LABEL, SECTION_HINT,
  type SettingsSection,
} from "@/types/settings"
import {
  SectionGeneral, SectionPackages, SectionOperations, SectionTv,
  SectionPayments, SectionNotifications, SectionStaff, SectionPrinter, SectionPricing,
} from "@/components/ayarlar/sections"

// ─── /ayarlar — Settings ─────────────────────────────────────────────────────
//
// Tablet-friendly two-column layout:
//   • Left: vertical tab nav with section labels + hints
//   • Right: active section form (auto-save on every change, save-bar at bottom)
//
// All changes persist to localStorage via SettingsProvider. Mobile renders the
// nav as a horizontal pill bar above the form.

const TAB_ICONS: Record<SettingsSection, LucideIcon> = {
  general:       SettingsIcon,
  packages:      Package,
  operations:    ShieldCheck,
  tv:            Tv,
  payments:      CreditCard,
  notifications: Bell,
  staff:         Users,
  printer:       Printer,
  pricing:       Zap,
}

const TABS: SettingsSection[] = ["general", "packages", "pricing", "operations", "tv", "payments", "notifications", "staff", "printer"]

export default function AyarlarPage() {
  const [active, setActive] = useState<SettingsSection>("general")

  return (
    <MainLayout title="Ayarlar" subtitle="Operasyonel tercihler ve sistem yapılandırması">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Vertical nav (desktop) / horizontal pills (mobile) */}
          <nav
            aria-label="Ayar bölümleri"
            className={cn(
              "lg:w-72 lg:flex-shrink-0",
              "overflow-x-auto lg:overflow-visible -mx-6 lg:mx-0 px-6 lg:px-0",
            )}
          >
            <ul className="flex lg:flex-col gap-1.5 lg:gap-0.5">
              {TABS.map((id) => {
                const Icon = TAB_ICONS[id]
                const isActive = active === id
                return (
                  <li key={id} className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setActive(id)}
                      className={cn(
                        "w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                        "min-h-[44px]",
                        isActive
                          ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        isActive
                          ? "bg-violet-500/15 text-violet-600 dark:text-violet-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                      )}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-bold",
                          isActive ? "text-violet-700 dark:text-violet-300" : "text-slate-900 dark:text-white",
                        )}>
                          {SECTION_LABEL[id]}
                        </p>
                        <p className="hidden lg:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {SECTION_HINT[id]}
                        </p>
                      </div>
                      {isActive && (
                        <div className="hidden lg:block w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Active section form */}
          <main className="flex-1 min-w-0">
            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-6">
              {active === "general"       && <SectionGeneral />}
              {active === "packages"      && <SectionPackages />}
              {active === "operations"    && <SectionOperations />}
              {active === "tv"            && <SectionTv />}
              {active === "payments"      && <SectionPayments />}
              {active === "notifications" && <SectionNotifications />}
              {active === "staff"         && <SectionStaff />}
              {active === "printer"       && <SectionPrinter />}
              {active === "pricing"       && <SectionPricing />}
            </div>
          </main>
        </div>
      </div>
    </MainLayout>
  )
}
