"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { ProductionAccounts } from "@/components/personel/production-accounts"

// ─── /personeller — Hesap & Yetki Yönetimi ────────────────────────────────────
//
// Production version: single-purpose admin page that lists every Supabase
// account and lets the admin manage role, module permissions, PIN, and
// account status. The earlier demo-data tabs (Vardiya, Aktivite, Analitik)
// were removed because they were rendering hard-coded sample data, which
// no longer belongs in a production deploy.

export default function PersonellerPage() {
  return (
    <MainLayout title="Personeller" subtitle="Hesap & Yetki Yönetimi">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <ProductionAccounts />
      </div>
    </MainLayout>
  )
}
