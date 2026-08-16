import { cn } from "@/lib/utils"

// ─── Package tier differentiation (subtle) ───────────────────────────────────
//
// STANDART vs PREMIUM need to be distinguishable at a glance without turning
// the calendar into a rainbow. Standard = neutral slate, Premium = a single
// restrained violet accent. Historical reservations (no tier) show their
// snapshot package label with no accent.

type Tier = "standard" | "premium" | null | undefined

/** Small text chip naming the package, tinted by tier. */
export function TierChip({ tier, label }: { tier: Tier; label?: string }) {
  const text = label ?? (tier === "premium" ? "Premium" : tier === "standard" ? "Standart" : null)
  if (!text) return null
  return (
    <span className={cn(
      "px-1.5 py-0.5 rounded-md text-[10px] font-semibold border",
      tier === "premium"
        ? "border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10"
        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800",
    )}>
      {text}
    </span>
  )
}

/** Avatar gradient by tier — premium gets a warm accent, everything else the
 *  neutral brand gradient. */
export function tierAvatarGradient(tier: Tier): string {
  return tier === "premium" ? "from-violet-500 to-fuchsia-600" : "from-slate-400 to-slate-500"
}

/** A calendar day dot colour by tier (subtle). */
export function tierDotClass(tier: Tier): string {
  return tier === "premium" ? "bg-violet-500" : "bg-pink-400"
}
