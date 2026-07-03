"use client"

import { useState } from "react"
import { Users, Activity } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { CrmDashboard } from "@/components/crm/crm-dashboard"
import { CrmTransactionsPanel } from "@/components/crm/crm-transactions-panel"
import { cn } from "@/lib/utils"

// ─── /crm — Müşteri & Üyelik workspace ─────────────────────────────────────
//
// Two-tab workspace:
//   • Müşteriler  — search, KPI strip, customer list (existing dashboard)
//   • Hareketler — session ledger with date range + phone filter + CSV export

type Tab = "customers" | "transactions"

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "customers",    label: "Müşteriler", icon: Users },
  { id: "transactions", label: "Hareketler", icon: Activity },
]

export default function CrmPage() {
  const [tab, setTab] = useState<Tab>("customers")

  return (
    <MainLayout title="Müşteriler & Üyelik" subtitle="CRM · arama · sadakat · geçmiş · hareketler">
      <div className="max-w-[1600px] mx-auto space-y-4">

        {/* Segmented tab pill — modern, sits at top like a badge control */}
        <nav
          aria-label="CRM sekmeler"
          className="inline-flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-slate-800/70 p-1"
        >
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                  active
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700/70"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </nav>

        {tab === "customers" && <CrmDashboard />}
        {tab === "transactions" && <CrmTransactionsPanel />}
      </div>
    </MainLayout>
  )
}
