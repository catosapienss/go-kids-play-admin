"use client"

import { useState } from "react"
import { BottomNav } from "@/components/app/bottom-nav"
import { HomeScreen } from "@/components/app/screens/home-screen"
import { PackagesScreen } from "@/components/app/screens/packages-screen"
import { QrScreen } from "@/components/app/screens/qr-screen"
import { WalletScreen } from "@/components/app/screens/wallet-screen"
import { ProfileScreen } from "@/components/app/screens/profile-screen"
import type { AppScreen } from "@/components/app/bottom-nav"

export default function AppPage() {
  const [screen, setScreen] = useState<AppScreen>("home")

  function renderScreen() {
    switch (screen) {
      case "home":      return <HomeScreen onNavigate={setScreen} />
      case "packages":  return <PackagesScreen />
      case "qr":        return <QrScreen />
      case "wallet":    return <WalletScreen />
      case "profile":   return <ProfileScreen />
    }
  }

  return (
    /* Full-viewport centered phone shell */
    <div className="fixed inset-0 flex items-center justify-center bg-slate-200 dark:bg-slate-900 overflow-hidden">
      {/* Desktop background pattern */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{ backgroundImage: "radial-gradient(circle, #6d28d9 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />

      {/* Phone shell */}
      <div className="relative w-full max-w-[390px] h-full sm:h-[844px] flex flex-col bg-white dark:bg-[#0a0a14] sm:rounded-[52px] overflow-hidden sm:shadow-2xl sm:shadow-black/40">

        {/* iOS-style status bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-8 pt-3 pb-1 bg-transparent z-10 sm:pt-4">
          <span className="text-[12px] font-semibold text-slate-900 dark:text-white tabular-nums">9:41</span>
          <div className="absolute left-1/2 -translate-x-1/2 top-0">
            {/* Dynamic island pill */}
            <div className="w-[120px] h-[34px] bg-black rounded-b-[22px] sm:rounded-b-[28px] flex items-center justify-center sm:w-[126px] sm:h-[37px]" />
          </div>
          <div className="flex items-center gap-1.5">
            {/* Signal bars */}
            <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
              <rect x="0" y="6" width="3" height="6" rx="1" fill="currentColor" className="text-slate-900 dark:text-white" />
              <rect x="4.5" y="4" width="3" height="8" rx="1" fill="currentColor" className="text-slate-900 dark:text-white" />
              <rect x="9" y="2" width="3" height="10" rx="1" fill="currentColor" className="text-slate-900 dark:text-white" />
              <rect x="13.5" y="0" width="3" height="12" rx="1" fill="currentColor" className="text-slate-900 dark:text-white opacity-30" />
            </svg>
            {/* WiFi */}
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M8 10a1 1 0 100 2 1 1 0 000-2z" fill="currentColor" className="text-slate-900 dark:text-white" />
              <path d="M4.93 7.07a4.5 4.5 0 016.14 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-slate-900 dark:text-white" />
              <path d="M2.1 4.24a8 8 0 0111.8 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-slate-900 dark:text-white opacity-50" />
            </svg>
            {/* Battery */}
            <div className="flex items-center gap-0.5">
              <div className="w-[22px] h-[11px] rounded-[2.5px] border border-slate-900/40 dark:border-white/40 relative flex items-center px-0.5">
                <div className="w-full h-[7px] rounded-sm bg-emerald-500" />
              </div>
              <div className="w-0.5 h-[5px] rounded-r-sm bg-slate-900/30 dark:bg-white/30" />
            </div>
          </div>
        </div>

        {/* Screen content */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 scrollbar-hide">
          {renderScreen()}
        </div>

        {/* Bottom nav */}
        <BottomNav active={screen} onChange={setScreen} />

        {/* iOS home indicator */}
        <div className="flex-shrink-0 flex justify-center pb-2 pt-1 bg-white dark:bg-[#0a0a14]">
          <div className="w-32 h-1 bg-slate-900/20 dark:bg-white/20 rounded-full" />
        </div>
      </div>
    </div>
  )
}
