import type { Organization } from "@/types/organizasyon"
import { ORG_PACKAGES } from "@/types/organizasyon"

export { ORG_PACKAGES }

// Production: demo organizations removed. Real reservations will be loaded
// from Supabase in a follow-up phase. Empty array makes /dogum-gunleri start
// clean instead of showing fabricated birthday parties.
export const ORGANIZATIONS: Organization[] = []

export const MONTHLY_ORG_STATS: { month: string; count: number; revenue: number }[] = []

export function getOrgById(id: string): Organization | undefined {
  return ORGANIZATIONS.find((o) => o.id === id)
}

export function getPackageById(id: string) {
  return ORG_PACKAGES.find((p) => p.id === id)
}
