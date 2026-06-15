"use client"

import { Home, Wallet, KeyRound, User, Package } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Parent Bottom Nav ────────────────────────────────────────────────────────
//
// Thumb-friendly tab bar. Five destinations, large touch targets (≥ 56 px),
// active state hints with both colour and a top "pill" indicator.

export type ParentTab = "home" | "code" | "packages" | "wallet" | "profile"

interface NavItem {
  id: ParentTab
  label: string
  icon: typeof Home
}

const ITEMS: NavItem[] = [
  { id: "home",     label: "Ana",    icon: Home },
  { id: "code",     label: "Kod",    icon: KeyRound },
  { id: "packages", label: "Paket",  icon: Package },
  { id: "wallet",   label: "Cüzdan", icon: Wallet },
  { id: "profile",  label: "Profil", icon: User },
]

interface Props {
  active: ParentTab
  onChange: (tab: ParentTab) => void
}

export function ParentBottomNav({ active, onChange }: Props) {
  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl",
        "border-t border-slate-200 dark:border-slate-800",
        // iOS safe-area
        "pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1",
      )}
      role="tablist"
    >
      <div className="flex items-stretch max-w-md mx-auto">
        {ITEMS.map((it) => {
          const isActive = active === it.id
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(it.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 min-h-[56px] py-1 relative transition-colors",
                isActive
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-slate-400 dark:text-slate-500",
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-violet-500"
                />
              )}
              <it.icon className={cn("w-5 h-5", isActive && "scale-110 transition-transform")} />
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                !isActive && "opacity-60",
              )}>
                {it.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
