"use client"

import { useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { CustomerSearchPalette } from "@/components/crm/customer-search-palette"
import { CustomerProfileSheet } from "@/components/crm/customer-profile-sheet"
import { type CustomerSummary } from "@/types/customer"

// ─── /crm — Customer History & Loyalty ───────────────────────────────────────
//
// Single-screen layout designed for tablet operation:
//
//   [Search palette ────────────────────────────] [Profile sheet pops in from right]
//
// Click a customer in the list → opens the sheet without losing the search
// context. Search query persists, so closing the sheet keeps the operator
// where they were.

export default function CrmPage() {
  const [openId, setOpenId] = useState<string | null>(null)

  function handleSelect(c: CustomerSummary) {
    setOpenId(c.id)
  }

  return (
    <MainLayout
      title="Müşteriler"
      subtitle="Hızlı arama · geçmiş · sadakat"
    >
      <div className="max-w-[1400px] mx-auto h-[calc(100vh-10rem)] flex flex-col">
        <CustomerSearchPalette
          onSelect={handleSelect}
          autoFocus
          className="flex-1 min-h-0"
        />
      </div>

      <CustomerProfileSheet
        parentId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
      />
    </MainLayout>
  )
}
