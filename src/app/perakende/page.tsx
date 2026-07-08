"use client"

import { useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { QuickSale } from "@/components/perakende/quick-sale"
import { RetailDayPanel } from "@/components/perakende/retail-day-panel"
import { ProductManager } from "@/components/perakende/product-manager"
import { WastePanel } from "@/components/perakende/waste-panel"
import { StockPanel } from "@/components/perakende/stock-panel"
import { useAuth } from "@/contexts/auth-context"
import { ShoppingCart, Package, PackageX, Boxes } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── /perakende — Retail Sales ────────────────────────────────────────────────
//
// Tabs:
//   1. Hızlı Satış  → cashier POS, everyone
//   2. Zayiat       → record retail loss/shrinkage, everyone
//   3. Stok         → inventory + monthly count, manager-only
//   4. Ürünler      → product CRUD, admin-only

type Tab = "sale" | "waste" | "stock" | "products"

export default function PerakendePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "super_admin"
  // Stock is a management tool → managers + admins.
  const isManager = isAdmin || user?.role === "manager"
  const [tab, setTab] = useState<Tab>("sale")
  // Bumped after every checkout so the day panel refreshes instantly.
  const [salesRefresh, setSalesRefresh] = useState(0)

  return (
    <MainLayout title="Perakende Satış" subtitle="Hızlı kasa · zayiat · ürün yönetimi">
      <div className="space-y-4">
        {/* Tab nav — Hızlı Satış & Zayiat for everyone, Ürünler admin-only */}
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <TabBtn active={tab === "sale"}  onClick={() => setTab("sale")}  icon={<ShoppingCart className="w-3.5 h-3.5" />} label="Hızlı Satış" />
          <TabBtn active={tab === "waste"} onClick={() => setTab("waste")} icon={<PackageX     className="w-3.5 h-3.5" />} label="Zayiat" />
          {isManager && (
            <TabBtn active={tab === "stock"} onClick={() => setTab("stock")} icon={<Boxes className="w-3.5 h-3.5" />} label="Stok" />
          )}
          {isAdmin && (
            <TabBtn active={tab === "products"} onClick={() => setTab("products")} icon={<Package className="w-3.5 h-3.5" />} label="Ürünler" />
          )}
        </div>

        {tab === "sale" && (
          <>
            {/* Daily finance summary + sales feed — visible to ALL staff */}
            <RetailDayPanel refreshKey={salesRefresh} />
            <QuickSale onSaleComplete={() => setSalesRefresh((k) => k + 1)} />
          </>
        )}
        {tab === "waste" && <WastePanel />}
        {tab === "stock" && isManager && <StockPanel />}
        {tab === "products" && isAdmin && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <ProductManager />
          </div>
        )}
      </div>
    </MainLayout>
  )
}

function TabBtn({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors",
        active
          ? "bg-violet-600 text-white"
          : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
      )}
    >
      {icon}
      {label}
    </button>
  )
}
