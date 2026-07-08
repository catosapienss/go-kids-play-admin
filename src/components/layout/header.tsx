"use client"

import { Search, Moon, Sun, Tv } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { ROLE_LABELS, ROLE_COLORS } from "@/types/auth"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { BranchSwitcher } from "@/components/branch/branch-switcher"
import { LockNowButton } from "@/components/system/lock-now-button"
import { DailyNotesButton } from "@/components/operations-log/daily-notes-button"
import { PresentationToggle } from "./presentation-toggle"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?"

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* Branch switcher — visible only to super_admin; static label otherwise */}
        <BranchSwitcher />

        {/* Search — fires the global quick-action launcher (also opens via ⌘K / Ctrl+K) */}
        <button
          type="button"
          onClick={() => {
            // Synthesize Cmd+K so the global listener picks it up.
            const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
            window.dispatchEvent(ev)
          }}
          aria-label="Hızlı işlem"
          className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm text-slate-500 dark:text-slate-400 w-48 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Ara veya hızlı işlem...</span>
          <kbd className="ml-auto text-xs bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">⌘K</kbd>
        </button>

        {/* TV Display quick-pop — opens kiosk display in a new tab */}
        {user && user.role !== "cashier" && (
          <a
            href="/tv/live"
            target="_blank"
            rel="noopener noreferrer"
            title="Canlı ekranı yeni sekmede aç"
            aria-label="Canlı TV ekranını aç"
            className="hidden md:flex w-9 h-9 rounded-xl items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Tv className="h-4 w-4" />
          </a>
        )}

        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Tema değiştir</span>
        </Button>

        {/* Presentation / privacy mode — admin-only, for screenshots */}
        <PresentationToggle />

        {/* Daily Operations Log — quick shift-note access from anywhere */}
        <DailyNotesButton />

        {/* Manual session lock — visible to every signed-in user */}
        <LockNowButton compact />

        {/* Notifications — wired to the alert engine */}
        <NotificationBell />

        {/* User avatar + role */}
        {user && (
          <div className="flex items-center gap-2">
            <div className="hidden md:flex flex-col items-end">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                {user.fullName}
              </p>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                ROLE_COLORS[user.role],
              )}>
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold cursor-pointer">
              {initials}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
