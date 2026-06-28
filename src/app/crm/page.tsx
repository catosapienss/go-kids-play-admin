import { MainLayout } from "@/components/layout/main-layout"
import { CrmDashboard } from "@/components/crm/crm-dashboard"

// ─── /crm — Customer Relationship Management ────────────────────────────────
//
// Three-region desktop CRM workspace:
//
//   • Stats strip   — Total / New This Month / Returning / Today's Visitors
//   • Search bar    — debounced, matches name / phone / child name / customer ID
//   • Customer table — Customer ID · Child · Parent · Phone · Last Visit · Visits · Badges
//
// Clicking a row opens the existing CustomerProfileSheet (slides in from the
// right) which renders the full visit history, payments timeline, and tags.

export default function CrmPage() {
  return (
    <MainLayout title="Müşteriler" subtitle="CRM · arama · sadakat · geçmiş">
      <CrmDashboard />
    </MainLayout>
  )
}
