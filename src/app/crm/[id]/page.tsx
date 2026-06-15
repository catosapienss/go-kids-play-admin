"use client"

import { notFound } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { ProfileHeader } from "@/components/crm/detail/profile-header"
import { OverviewCharts } from "@/components/crm/detail/overview-charts"
import { ChildrenSection } from "@/components/crm/detail/children-section"
import { VisitHistory } from "@/components/crm/detail/visit-history"
import { WalletSection } from "@/components/crm/detail/wallet-section"
import { OrganizationsSection } from "@/components/crm/detail/organizations-section"
import { NotesSection } from "@/components/crm/detail/notes-section"
import { getCustomerById } from "@/lib/crm-data"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Baby, Clock, Wallet, CalendarDays, StickyNote } from "lucide-react"

interface PageProps {
  params: { id: string }
}

export default function CustomerDetailPage({ params }: PageProps) {
  const customer = getCustomerById(params.id)
  if (!customer) notFound()

  return (
    <MainLayout
      title={customer.name}
      subtitle={`${customer.totalVisits} ziyaret · ₺${customer.totalSpend.toLocaleString("tr-TR")} toplam`}
    >
      <ProfileHeader customer={customer} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 h-auto flex-wrap gap-1 shadow-sm">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
            <BarChart3 className="w-3.5 h-3.5" />
            Genel Bakış
          </TabsTrigger>
          <TabsTrigger value="children" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
            <Baby className="w-3.5 h-3.5" />
            Çocuklar
            {customer.children.length > 0 && (
              <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-violet-100 text-violet-700 data-[state=active]:bg-white/25 data-[state=active]:text-white text-[10px] font-bold flex items-center justify-center">
                {customer.children.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="visits" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
            <Clock className="w-3.5 h-3.5" />
            Ziyaretler
          </TabsTrigger>
          <TabsTrigger value="wallet" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
            <Wallet className="w-3.5 h-3.5" />
            Cüzdan
          </TabsTrigger>
          <TabsTrigger value="organizations" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
            <CalendarDays className="w-3.5 h-3.5" />
            Organizasyonlar
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
            <StickyNote className="w-3.5 h-3.5" />
            Notlar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewCharts customer={customer} />
        </TabsContent>

        <TabsContent value="children">
          <ChildrenSection customer={customer} />
        </TabsContent>

        <TabsContent value="visits">
          <VisitHistory customer={customer} />
        </TabsContent>

        <TabsContent value="wallet">
          <WalletSection customer={customer} />
        </TabsContent>

        <TabsContent value="organizations">
          <OrganizationsSection customer={customer} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesSection customer={customer} />
        </TabsContent>
      </Tabs>
    </MainLayout>
  )
}
