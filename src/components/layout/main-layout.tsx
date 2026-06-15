"use client"

import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { useState } from "react"
import { Menu, X, Baby } from "lucide-react"
import { cn } from "@/lib/utils"
import { RoleGuard } from "@/components/auth/role-guard"
import { AlertEngineMount } from "@/components/notifications/alert-engine-mount"

interface MainLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <RoleGuard>
    <>
    <AlertEngineMount />
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar />
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1 rounded-lg bg-slate-100 dark:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile Header with menu button */}
        <div className="md:hidden flex items-center h-14 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Baby className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white text-sm">GoKids Play</span>
          </div>
        </div>

        <Header title={title} subtitle={subtitle} />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
    </>
    </RoleGuard>
  )
}
