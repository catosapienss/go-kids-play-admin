"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { useParentSession } from "@/hooks/use-parent-session"
import { ParentSignIn } from "@/components/parent/parent-sign-in"
import { ParentBottomNav, type ParentTab } from "@/components/parent/parent-bottom-nav"
import {
  ParentHomeScreen, ParentCodeScreen, ParentWalletScreen, ParentProfileScreen,
} from "@/components/parent/parent-screens"
import { ParentPackagesScreen } from "@/components/parent/parent-packages-screen"
import { PwaInstallPrompt } from "@/components/parent/pwa-install-prompt"
import { useServiceWorker } from "@/hooks/use-service-worker"
import { cn } from "@/lib/utils"

// ─── /parent — Parent Mobile Portal ──────────────────────────────────────────
//
// Single-page mobile app that switches between five tabs internally.
// Auth: passwordless via entry code (same RPC the cashier uses). The code is
// stored in localStorage so subsequent app opens skip the sign-in screen.
//
// Tab transitions are animated via a `key`-swap + brief fade/slide so the
// shell feels app-native instead of like instant page-flips.

const TAB_ORDER: ParentTab[] = ["home", "code", "packages", "wallet", "profile"]

export default function ParentPortalPage() {
  const { bundle, isLoading, error, signIn, signOut } = useParentSession()
  const [tab, setTab] = useState<ParentTab>("home")
  const [prevTabIndex, setPrevTabIndex] = useState(0)
  const prevTabIndexRef = useRef(0)

  // Register the service worker — adds an installable / offline shell.
  useServiceWorker("/sw.js")

  // Track tab transitions to derive a direction (slide-left vs slide-right).
  useEffect(() => {
    const newIndex = TAB_ORDER.indexOf(tab)
    setPrevTabIndex(prevTabIndexRef.current)
    prevTabIndexRef.current = newIndex
  }, [tab])

  // First-paint loading shimmer
  if (isLoading && !bundle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    )
  }

  // Not signed in → code-entry hero
  if (!bundle) {
    return <ParentSignIn onSubmit={signIn} error={error} />
  }

  const currentIndex = TAB_ORDER.indexOf(tab)
  const slideFromRight = currentIndex >= prevTabIndex

  // Signed in → portal shell
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      {/* Safe-area top spacer (status bar) */}
      <div className="h-[max(env(safe-area-inset-top),1.25rem)] bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800" />

      {/* Tab content with key-driven page-transition. The class swap below
          triggers a small slide-in animation when the tab changes. */}
      <div
        key={tab}
        className={cn(
          "transition-opacity",
          slideFromRight
            ? "animate-[parentSlideR_220ms_ease-out]"
            : "animate-[parentSlideL_220ms_ease-out]",
        )}
      >
        {tab === "home"     && <ParentHomeScreen     bundle={bundle} />}
        {tab === "code"     && <ParentCodeScreen     bundle={bundle} />}
        {tab === "packages" && <ParentPackagesScreen bundle={bundle} />}
        {tab === "wallet"   && <ParentWalletScreen   bundle={bundle} />}
        {tab === "profile"  && <ParentProfileScreen  bundle={bundle} onSignOut={signOut} />}
      </div>

      {/* Install banner — surfaces a discrete "Ana ekrana ekle" CTA once. */}
      <PwaInstallPrompt />

      <ParentBottomNav active={tab} onChange={setTab} />

      <style jsx global>{`
        @keyframes parentSlideR {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes parentSlideL {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
