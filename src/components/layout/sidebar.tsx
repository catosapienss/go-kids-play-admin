"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, UserPlus, Play, Users, Cake,
  Wallet, BarChart3, UserCheck, Settings,
  ChevronLeft, ChevronRight, LogOut, ShieldCheck, Sparkles, Tv, Video,
  ClipboardList, Activity, CheckSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/auth-context"
import { ROLE_LABELS, ROLE_COLORS } from "@/types/auth"
import type { UserRole } from "@/types/auth"
import { BrandLogo } from "@/components/brand-logo"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
  external?: boolean
}

interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "Operasyon",
    items: [
      { href: "/",              label: "Dashboard",        icon: LayoutDashboard, roles: ["super_admin", "admin", "manager"] },
      { href: "/hizli-kayit",   label: "Hızlı Kayıt",      icon: UserPlus,        roles: ["super_admin", "admin", "manager", "staff", "cashier"] },
      { href: "/aktif-oyun",    label: "Aktif Oyun Alanı", icon: Play,            roles: ["super_admin", "admin", "manager", "staff", "cashier"] },
    ],
  },
  {
    id: "customers",
    label: "Müşteri & Üyelik",
    items: [
      { href: "/crm",           label: "Müşteriler",       icon: Users,           roles: ["super_admin", "admin", "manager"] },
      { href: "/uyelikler",     label: "Üyelikler",        icon: Sparkles,        roles: ["super_admin", "admin", "manager"] },
      { href: "/cuzdan",        label: "Cüzdan",           icon: Wallet,          roles: ["super_admin", "admin", "manager"] },
      { href: "/dogum-gunleri", label: "Doğum Günleri",    icon: Cake,            roles: ["super_admin", "admin", "manager"] },
    ],
  },
  {
    id: "finance",
    label: "Finans & Analiz",
    items: [
      { href: "/raporlar",      label: "Raporlar",         icon: BarChart3,       roles: ["super_admin", "admin", "manager"] },
      { href: "/gun-sonu",      label: "Gün Sonu Kapanış", icon: ShieldCheck,     roles: ["super_admin", "admin", "manager", "staff", "cashier"] },
    ],
  },
  {
    id: "system",
    label: "Sistem",
    items: [
      { href: "/personeller",   label: "Personel Yönetimi",icon: UserCheck,       roles: ["super_admin", "admin"] },
      { href: "/audit-log",     label: "İşlem Kayıtları",  icon: ClipboardList,   roles: ["super_admin", "admin", "manager"] },
      { href: "/tv/live",       label: "TV Ekranı",        icon: Tv,              roles: ["super_admin", "admin", "manager"], external: true },
      { href: "/canli",         label: "Oyun Alanı Ekranı",icon: Video,           roles: ["super_admin", "admin", "manager"], external: true },
      { href: "/durum",          label: "İşletme Özeti",    icon: CheckSquare,     roles: ["super_admin", "admin", "manager"] },
      { href: "/dev-status",    label: "Sistem Durumu",    icon: Activity,        roles: ["super_admin", "admin"] },
      { href: "/ayarlar",       label: "Ayarlar",          icon: Settings,        roles: ["super_admin", "admin"] },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { user, signOut } = useAuth()

  const visibleGroups = user
    ? NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(user.role)) }))
        .filter((g) => g.items.length > 0)
    : []

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?"

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center h-16 px-4 border-b border-slate-200 dark:border-slate-800",
          collapsed ? "justify-center" : "",
        )}>
          <BrandLogo size="sm" on="light" variant={collapsed ? "mark" : "full"} />
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {visibleGroups.map((group, gi) => (
            <div key={group.id} className={cn(gi > 0 && "mt-4")}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">
                  {group.label}
                </p>
              )}
              {collapsed && gi > 0 && (
                <div className="mx-3 mb-2 mt-1 h-px bg-slate-200 dark:bg-slate-800" aria-hidden />
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = !item.external && (
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href))
                  )

                  const navLink = item.external ? (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150",
                        collapsed ? "justify-center" : "",
                        "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                      )}
                    >
                      <Icon className="flex-shrink-0 w-5 h-5" />
                      {!collapsed && (
                        <>
                          <span>{item.label}</span>
                          <span className="ml-auto text-[10px] font-mono text-slate-400">↗</span>
                        </>
                      )}
                    </a>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150",
                        collapsed ? "justify-center" : "",
                        isActive
                          ? "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                      )}
                    >
                      <Icon className={cn("flex-shrink-0 w-5 h-5", isActive ? "text-violet-600 dark:text-violet-400" : "")} />
                      {!collapsed && <span>{item.label}</span>}
                      {!collapsed && isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />
                      )}
                    </Link>
                  )

                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}{item.external && " ↗"}</TooltipContent>
                      </Tooltip>
                    )
                  }
                  return navLink
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User area */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
          {!collapsed && user && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {user.fullName}
                </p>
                <span className={cn(
                  "inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  ROLE_COLORS[user.role],
                )}>
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </div>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={signOut}
                  className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Çıkış Yap</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Çıkış Yap
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow z-10"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-slate-500" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-slate-500" />
          )}
        </button>
      </aside>
    </TooltipProvider>
  )
}
