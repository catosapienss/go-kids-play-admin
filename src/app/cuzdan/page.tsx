"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { LayoutDashboard, ArrowLeftRight, Wallet, Moon } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { StatsHero } from "@/components/cuzdan/stats-hero"
import { FilterBar } from "@/components/cuzdan/filter-bar"
import { TransactionTimeline } from "@/components/cuzdan/transaction-timeline"
import { WalletGrid } from "@/components/cuzdan/wallet-grid"
import { DaySummaryPanel } from "@/components/cuzdan/day-summary"
import { AnalyticsSection } from "@/components/cuzdan/analytics-section"
import { RefundModal } from "@/components/cuzdan/refund-modal"
import { WalletLoadModal } from "@/components/cuzdan/wallet-load-modal"
import { TODAY_TRANSACTIONS, HOURLY_DATA, WEEKLY_DATA } from "@/lib/cuzdan-data"
import { getTodayFinanceSummary, getAllWalletSummaries } from "@/lib/services/finance.service"
import type { DbWalletTransaction } from "@/types/finance"
import type { FinTransaction, CustomerWallet, DaySummary } from "@/types/cuzdan"
import { cn } from "@/lib/utils"

function mapSummaryToDaySummary(s: Awaited<ReturnType<typeof getTodayFinanceSummary>>): DaySummary {
  return {
    date: new Date().toLocaleDateString("tr-TR"),
    totalCash: s.totalCash,
    totalCard: s.totalCard,
    totalWallet: s.totalWallet,
    totalRefund: s.totalRefunded,
    splitPaymentCount: 0,
    txCount: s.txCount,
    walletLoadAmount: s.walletLoaded,
    netRevenue: s.netRevenue,
    avgTxAmount: s.txCount > 0 ? Math.round(s.netRevenue / s.txCount) : 0,
  }
}

function mapDbTxToWalletTx(tx: DbWalletTransaction) {
  return {
    id: tx.id,
    type: tx.type as "load" | "use" | "bonus" | "refund",
    amount: Number(tx.amount),
    datetime: new Date(tx.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    note: tx.description,
    staffName: tx.created_by ?? "Sistem",
  }
}

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "transactions", label: "İşlemler", icon: ArrowLeftRight },
  { id: "wallets", label: "Cüzdanlar", icon: Wallet },
  { id: "day-end", label: "Gün Sonu", icon: Moon },
]

export default function CuzdanPage() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [refundTx, setRefundTx] = useState<FinTransaction | null>(null)
  const [loadWalletTarget, setLoadWalletTarget] = useState<CustomerWallet | null>(null)
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null)
  const [wallets, setWallets] = useState<CustomerWallet[]>([])

  const fetchWallets = useCallback(async () => {
    try {
      const summaries = await getAllWalletSummaries()
      setWallets(summaries.map((s) => ({
        id: s.parentId,
        name: s.parentName,
        phone: s.phone,
        balance: s.balance,
        bonusBalance: s.recentTransactions.filter((t) => t.type === "bonus").reduce((acc, t) => acc + Number(t.amount), 0),
        totalLoaded: s.recentTransactions.filter((t) => t.type === "load").reduce((acc, t) => acc + Number(t.amount), 0),
        totalUsed: s.recentTransactions.filter((t) => t.type === "use").reduce((acc, t) => acc + Number(t.amount), 0),
        lastActivity: s.recentTransactions[0]?.created_at
          ? new Date(s.recentTransactions[0].created_at).toLocaleDateString("tr-TR")
          : "—",
        transactions: s.recentTransactions.map(mapDbTxToWalletTx),
      })))
    } catch {}
  }, [])

  useEffect(() => {
    getTodayFinanceSummary()
      .then((s) => setDaySummary(mapSummaryToDaySummary(s)))
      .catch(() => {})
    fetchWallets()
  }, [fetchWallets])

  const filteredTransactions = useMemo(() => {
    return TODAY_TRANSACTIONS.filter((tx) => {
      const matchesSearch =
        !search ||
        tx.customerName.toLowerCase().includes(search.toLowerCase()) ||
        tx.service.toLowerCase().includes(search.toLowerCase())

      const matchesFilter =
        filter === "all" ||
        tx.type === filter ||
        (filter === "split" && tx.method === "split")

      return matchesSearch && matchesFilter
    })
  }, [search, filter])

  const recentTransactions = useMemo(
    () => [...TODAY_TRANSACTIONS].reverse().slice(0, 8),
    []
  )

  return (
    <MainLayout title="Cüzdan" subtitle="Finans & Ödeme Yönetimi">
      <div className="space-y-4">
        {/* Stats hero */}
        {daySummary && <StatsHero summary={daySummary} />}

        {/* Tab navigation */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
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

          {/* Dashboard tab */}
          {activeTab === "dashboard" && (
            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Son İşlemler</p>
                  <button
                    onClick={() => setActiveTab("transactions")}
                    className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700"
                  >
                    Tümünü Gör →
                  </button>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl overflow-hidden">
                  <TransactionTimeline
                    transactions={recentTransactions}
                    onRefund={setRefundTx}
                    compact
                  />
                </div>
              </div>
              {daySummary && (
                <AnalyticsSection
                  hourlyData={HOURLY_DATA}
                  weeklyData={WEEKLY_DATA}
                  summary={daySummary}
                />
              )}
            </div>
          )}

          {/* Transactions tab */}
          {activeTab === "transactions" && (
            <div className="p-4 space-y-4">
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                filter={filter}
                onFilterChange={setFilter}
              />
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {filteredTransactions.length} işlem
                  </p>
                  <p className="text-xs text-slate-400">11 Mayıs 2026</p>
                </div>
                <TransactionTimeline
                  transactions={[...filteredTransactions].reverse()}
                  onRefund={setRefundTx}
                />
              </div>
            </div>
          )}

          {/* Wallets tab */}
          {activeTab === "wallets" && (
            <div className="p-4">
              <WalletGrid wallets={wallets} onLoad={setLoadWalletTarget} />
            </div>
          )}

          {/* Day-end tab */}
          {activeTab === "day-end" && daySummary && (
            <div className="p-4">
              <DaySummaryPanel summary={daySummary} />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <RefundModal transaction={refundTx} onClose={() => setRefundTx(null)} />
      <WalletLoadModal
        wallet={loadWalletTarget}
        onClose={() => setLoadWalletTarget(null)}
        onLoaded={fetchWallets}
      />
    </MainLayout>
  )
}
