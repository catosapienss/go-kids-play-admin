"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Compass, X, ExternalLink, LayoutDashboard, UserPlus, Play, Users, Cake,
  Wallet, BarChart3, ShieldCheck, UserCheck, Settings, Sparkles, Building2,
  Tv, Smartphone, KeyRound, FlaskConical, Activity, Bug, AlertOctagon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"

// ─── System Test Launcher ─────────────────────────────────────────────────────
//
// Dev-only "everything in one place" panel that exposes every route in the
// platform — including the ones that aren't in the regular sidebar (TV
// display, parent mobile portal, dev status, etc).
//
// Visible only in:
//   • NODE_ENV !== "production"
//   • OR signed-in user is super_admin / admin (covers staging deployments)
//
// Triggered by a floating compass button bottom-right (above the existing
// Demo button, below the Bug panel) — keyboard shortcut Cmd/Ctrl+Shift+T.

interface RouteEntry {
  href: string
  label: string
  hint: string
  icon: LucideIcon
  /** Open in new tab (for TV / parent — they have separate layouts). */
  external?: boolean
}

interface RouteGroup {
  id: string
  title: string
  tone: "violet" | "emerald" | "blue" | "fuchsia" | "amber" | "slate"
  items: RouteEntry[]
}

const GROUPS: RouteGroup[] = [
  {
    id: "ops", title: "Operasyon", tone: "violet",
    items: [
      { href: "/",             label: "Dashboard",         hint: "Yönetici paneli · KPI · canlı",          icon: LayoutDashboard },
      { href: "/hizli-kayit",  label: "Hızlı Kayıt",       hint: "Kasiyer giriş ekranı",                   icon: UserPlus },
      { href: "/aktif-oyun",   label: "Aktif Oyun",        hint: "Canlı süre yönetimi",                    icon: Play },
      { href: "/gun-sonu",     label: "Gün Sonu",          hint: "Kasa sayımı + mutabakat",                icon: ShieldCheck },
    ],
  },
  {
    id: "crm", title: "Müşteri & Üyelik", tone: "blue",
    items: [
      { href: "/crm",          label: "Müşteri Arama",      hint: "Müşteri profil + geçmiş",                icon: Users },
      { href: "/uyelikler",    label: "Üyelikler",          hint: "Sınırsız · aylık · kontörlü",            icon: Sparkles },
      { href: "/cuzdan",       label: "Cüzdan",             hint: "Bakiye + yükleme + iadeler",             icon: Wallet },
      { href: "/dogum-gunleri",label: "Doğum Günleri",      hint: "Organizasyon yönetimi",                  icon: Cake },
    ],
  },
  {
    id: "analytics", title: "Analitik & Rapor", tone: "fuchsia",
    items: [
      { href: "/raporlar",     label: "Raporlar (BI)",      hint: "4 sekmeli analytics dashboard",           icon: BarChart3 },
    ],
  },
  {
    id: "kiosk", title: "Müşteri & Kiosk", tone: "amber",
    items: [
      { href: "/parent",       label: "Veli Portalı",       hint: "PWA mobile customer app",                icon: Smartphone, external: true },
      { href: "/tv/live",      label: "Canlı TV Ekranı",    hint: "Premium kiosk display",                  icon: Tv,         external: true },
      { href: "/tv",           label: "TV (legacy)",        hint: "Eski demo TV görünümü",                  icon: Tv,         external: true },
      { href: "/app",          label: "Mobil Showcase",     hint: "Demo iPhone UI showcase",                icon: Smartphone, external: true },
    ],
  },
  {
    id: "staff", title: "Personel & Sistem", tone: "emerald",
    items: [
      { href: "/personeller",  label: "Personel & Vardiya", hint: "Aktivite + iadeler + clock-in",          icon: UserCheck },
      { href: "/ayarlar",      label: "Ayarlar",            hint: "Sistem ayarları",                        icon: Settings },
      { href: "/subeler",      label: "Şubeler",            hint: "Super-admin · multi-branch",             icon: Building2 },
    ],
  },
  {
    id: "dev", title: "Geliştirici", tone: "slate",
    items: [
      { href: "/dev-status",   label: "Sistem Durumu",      hint: "Route envanteri + modül sağlığı",        icon: Activity },
      { href: "/login",        label: "Login ekranı",       hint: "Auth ekranını test et",                  icon: KeyRound },
      { href: "/403",          label: "403 sayfası",        hint: "Yetki reddi ekranı",                     icon: AlertOctagon },
    ],
  },
]

const TONE: Record<RouteGroup["tone"], { bg: string; fg: string }> = {
  violet:  { bg: "bg-violet-500/10",  fg: "text-violet-700 dark:text-violet-300" },
  emerald: { bg: "bg-emerald-500/10", fg: "text-emerald-700 dark:text-emerald-300" },
  blue:    { bg: "bg-blue-500/10",    fg: "text-blue-700 dark:text-blue-300" },
  fuchsia: { bg: "bg-fuchsia-500/10", fg: "text-fuchsia-700 dark:text-fuchsia-300" },
  amber:   { bg: "bg-amber-500/10",   fg: "text-amber-700 dark:text-amber-300" },
  slate:   { bg: "bg-slate-500/10",   fg: "text-slate-700 dark:text-slate-300" },
}

export function SystemTestLauncher() {
  const { user } = useAuth()
  // Strict dev-only — production never surfaces this developer compass.
  const shouldShow = process.env.NODE_ENV !== "production"
  void user

  const [open, setOpen] = useState(false)

  // ⌘ / Ctrl + Shift + T toggles the launcher.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  if (!shouldShow) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="System test launcher"
        className={cn(
          // Position: between health-panel (bottom-left) and demo (bottom-right).
          "fixed bottom-4 left-16 z-40 h-10 px-3 rounded-xl",
          "bg-gradient-to-r from-sky-500 to-cyan-500 text-white",
          "text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-500/30",
          "hover:shadow-sky-500/50 transition-all",
          open && "ring-2 ring-sky-300",
        )}
        title="System Test Launcher (Cmd/Ctrl + Shift + T)"
      >
        <Compass className="w-4 h-4" />
        Test
      </button>

      {open && <Drawer onClose={() => setOpen(false)} />}
    </>
  )
}

function Drawer({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()

  return (
    <div
      className={cn(
        "fixed bottom-16 left-4 z-40 w-[420px] max-w-[calc(100vw-1rem)] max-h-[80vh]",
        "rounded-2xl border border-slate-200 dark:border-slate-700",
        "bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg",
        "shadow-2xl shadow-slate-900/20 dark:shadow-black/50",
        "overflow-hidden flex flex-col",
        "animate-[fadeInUp_140ms_ease-out]",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-sky-500" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Test Launcher</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Tüm route ve modüller · {user?.role ?? "anonim"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline-flex text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
            ⌘⇧T
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {GROUPS.map((g) => {
          const t = TONE[g.tone]
          return (
            <div key={g.id} className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900/60 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-2">
                <span className={cn("text-[10px] uppercase tracking-widest font-bold", t.fg)}>
                  {g.title}
                </span>
                <span className="text-[10px] text-slate-400 ml-auto tabular-nums">{g.items.length}</span>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {g.items.map((it) => {
                  const Linker = it.external ? "a" : Link
                  return (
                    <li key={it.href}>
                      <Linker
                        {...(it.external
                          ? { href: it.href, target: "_blank", rel: "noopener noreferrer" }
                          : { href: it.href, onClick: onClose })}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", t.bg, t.fg)}>
                          <it.icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{it.label}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            <span className="font-mono">{it.href}</span>
                            <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>
                            {it.hint}
                          </p>
                        </div>
                        {it.external && <ExternalLink className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0" />}
                      </Linker>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-[10px] text-slate-400">
        <Bug className="w-2.5 h-2.5" />
        <span className="flex-1">Sol alt · sistem sağlık paneli</span>
        <Compass className="w-2.5 h-2.5" />
        <span>Bu panel</span>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
