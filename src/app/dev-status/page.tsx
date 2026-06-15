"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Activity, CheckCircle2, AlertCircle, ExternalLink, Database, Radio,
  Compass, Wifi, WifiOff, RotateCw, Layers, ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MainLayout } from "@/components/layout/main-layout"
import { createClient } from "@/lib/supabase/client"
import { useNetworkStatus } from "@/lib/reliability/network-status"
import { useRealtimeSupervisor } from "@/lib/reliability/realtime-supervisor"
import { useSessionStore } from "@/lib/stores/session-store"
import { useNotificationStore } from "@/lib/stores/notification-store"
import { useBranch } from "@/lib/branch/branch-context"
import { useAuth } from "@/contexts/auth-context"

// ─── /dev-status — Developer Status Page ─────────────────────────────────────
//
// Single page that surfaces *everything* a developer / QA tester needs to
// verify the platform's state at a glance:
//
//   • Route inventory (live links)
//   • Module health (real Supabase pings of each major table)
//   • Network + realtime + reconnect token
//   • Auth + branch context
//   • In-memory store sizes
//
// Wired in addition to the floating System Test Launcher (which is the quick
// navigation surface). This page is the *deep* inspection view.

interface RouteInfo {
  path: string
  label: string
  group: string
  notes?: string
  external?: boolean
}

const ROUTES: RouteInfo[] = [
  { path: "/",              label: "Dashboard",            group: "Operasyon" },
  { path: "/hizli-kayit",   label: "Hızlı Kayıt",          group: "Operasyon" },
  { path: "/aktif-oyun",    label: "Aktif Oyun",           group: "Operasyon" },
  { path: "/gun-sonu",      label: "Gün Sonu",             group: "Operasyon" },
  { path: "/crm",           label: "CRM",                  group: "Müşteri" },
  { path: "/uyelikler",     label: "Üyelikler",            group: "Müşteri" },
  { path: "/cuzdan",        label: "Cüzdan",               group: "Müşteri" },
  { path: "/dogum-gunleri", label: "Doğum Günleri",        group: "Müşteri" },
  { path: "/raporlar",      label: "Raporlar (BI)",        group: "Analitik" },
  { path: "/personeller",   label: "Personel & Vardiya",   group: "Personel" },
  { path: "/subeler",       label: "Şubeler",              group: "Personel", notes: "super_admin" },
  { path: "/ayarlar",       label: "Ayarlar",              group: "Personel" },
  { path: "/parent",        label: "Veli Portal (PWA)",    group: "Kiosk", external: true },
  { path: "/tv/live",       label: "Canlı TV Display",     group: "Kiosk", external: true },
  { path: "/tv",            label: "TV (legacy demo)",     group: "Kiosk", external: true },
  { path: "/app",           label: "Mobile Showcase",      group: "Kiosk", external: true },
  { path: "/login",         label: "Login",                group: "Auth" },
  { path: "/403",           label: "403",                  group: "Auth" },
]

// Tables we ping to make sure migrations have been applied.
const MODULES: Array<{ table: string; label: string; migration: string }> = [
  { table: "profiles",              label: "Auth & Profiles",       migration: "001" },
  { table: "sessions",              label: "Sessions",              migration: "core" },
  { table: "payments",              label: "Payments",              migration: "core" },
  { table: "wallet_transactions",   label: "Wallet",                migration: "003" },
  { table: "refund_logs",           label: "Refund Logs",           migration: "003" },
  { table: "audit_logs",            label: "Audit (Reliability)",   migration: "006" },
  { table: "idempotency_keys",      label: "Idempotency",           migration: "006" },
  { table: "entry_codes",           label: "Entry Codes",           migration: "008" },
  { table: "cash_register_closings",label: "Cash Register",         migration: "009" },
  { table: "staff_shifts",          label: "Staff Shifts",          migration: "010" },
  { table: "customer_summary",      label: "Customer Summary view", migration: "011" },
  { table: "pending_reservations",  label: "Mobile Reservations",   migration: "013" },
  { table: "memberships",           label: "Memberships",           migration: "014" },
  { table: "branches",              label: "Branches (Multi)",      migration: "005" },
  { table: "organizations",         label: "Organizations",         migration: "optional" },
]

interface ModuleStatus {
  table: string
  ok: boolean
  detail: string
}

export default function DevStatusPage() {
  const { user } = useAuth()
  const { online, realtimeConnected } = useNetworkStatus()
  const { reconnectToken, lastReconnectAt, requestResync } = useRealtimeSupervisor()
  const { sessions, events } = useSessionStore()
  const { notifications, unreadCount } = useNotificationStore()
  const { activeBranch, canSwitch, branches } = useBranch()

  const [moduleStatus, setModuleStatus] = useState<ModuleStatus[]>([])
  const [pinging, setPinging] = useState(false)

  async function pingModules() {
    setPinging(true)
    const supabase = createClient()
    const results = await Promise.all(MODULES.map(async (m) => {
      try {
        const { error } = await supabase.from(m.table).select("*", { count: "exact", head: true }).limit(1)
        if (error) return { table: m.table, ok: false, detail: error.message.slice(0, 80) }
        return { table: m.table, ok: true, detail: "OK" }
      } catch (e) {
        return { table: m.table, ok: false, detail: e instanceof Error ? e.message.slice(0, 80) : "error" }
      }
    }))
    setModuleStatus(results)
    setPinging(false)
  }

  useEffect(() => { void pingModules() }, [])

  // Group routes
  const grouped = ROUTES.reduce<Record<string, RouteInfo[]>>((acc, r) => {
    acc[r.group] = acc[r.group] ?? []
    acc[r.group].push(r)
    return acc
  }, {})

  const okCount = moduleStatus.filter((m) => m.ok).length
  const failCount = moduleStatus.length - okCount

  return (
    <MainLayout title="Sistem Durumu" subtitle="Route envanteri · modül sağlığı · runtime state">
      <div className="max-w-[1400px] mx-auto space-y-5">
        {/* Top KPI strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat
            label="Bağlantı"
            value={online ? "Online" : "Offline"}
            icon={online ? Wifi : WifiOff}
            tone={online ? "good" : "bad"}
          />
          <Stat
            label="Realtime"
            value={realtimeConnected ? "Bağlı" : "Kopuk"}
            icon={Radio}
            tone={realtimeConnected ? "good" : "warn"}
          />
          <Stat
            label="Modüller"
            value={moduleStatus.length === 0 ? "..." : `${okCount}/${moduleStatus.length}`}
            icon={Database}
            tone={moduleStatus.length === 0 ? "warn" : failCount === 0 ? "good" : "warn"}
          />
          <Stat
            label="Reconnect token"
            value={String(reconnectToken)}
            icon={RotateCw}
            tone="neutral"
          />
        </section>

        {/* Modules health */}
        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Modül & Migration Sağlığı</h2>
            <span className="text-[11px] text-slate-400 ml-auto">{moduleStatus.length} kontrol</span>
            <button
              type="button"
              onClick={pingModules}
              disabled={pinging}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
            >
              <RotateCw className={cn("w-3 h-3", pinging && "animate-spin")} />
              Tekrar dene
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800">
            {MODULES.map((m) => {
              const status = moduleStatus.find((s) => s.table === m.table)
              return (
                <div key={m.table} className="bg-white dark:bg-slate-900 px-4 py-2.5 flex items-start gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5",
                    !status ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    : status.ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    : "bg-rose-500/15 text-rose-600 dark:text-rose-300",
                  )}>
                    {!status
                      ? "·"
                      : status.ok
                      ? <CheckCircle2 className="w-3.5 h-3.5" />
                      : <AlertCircle className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{m.label}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                      {m.table} <span className="text-slate-300 dark:text-slate-600">·</span> mig {m.migration}
                    </p>
                    {status && !status.ok && (
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 truncate" title={status.detail}>
                        {status.detail}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Routes inventory */}
        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-sky-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Tüm Rotalar</h2>
            <span className="text-[11px] text-slate-400 ml-auto">{ROUTES.length} sayfa</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800">
            {Object.entries(grouped).map(([group, routes]) => (
              <div key={group} className="bg-white dark:bg-slate-900 p-3">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2">
                  {group}
                </p>
                <ul className="space-y-1">
                  {routes.map((r) => {
                    const Linker = r.external ? "a" : Link
                    return (
                      <li key={r.path}>
                        <Linker
                          {...(r.external
                            ? { href: r.path, target: "_blank", rel: "noopener noreferrer" }
                            : { href: r.path })}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                        >
                          <span className="font-bold text-slate-900 dark:text-white">{r.label}</span>
                          <span className="font-mono text-slate-400 text-[10px]">{r.path}</span>
                          {r.notes && (
                            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              {r.notes}
                            </span>
                          )}
                          <ExternalLink className={cn(
                            "w-3 h-3 ml-auto",
                            r.external ? "text-slate-400" : "opacity-0 group-hover:opacity-50 text-slate-400",
                          )} />
                        </Linker>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Runtime state */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Auth & Branch" icon={ShieldCheck}>
            <KV k="user"          v={user?.email ?? "—"} />
            <KV k="role"          v={user?.role ?? "—"} />
            <KV k="branch"        v={activeBranch?.branchName ?? (canSwitch ? "Tüm Şubeler" : "—")} />
            <KV k="branch code"   v={activeBranch?.branchCode ?? "—"} />
            <KV k="branches loaded" v={String(branches.length)} />
            <KV k="can switch"    v={String(canSwitch)} />
          </Card>

          <Card title="Runtime Stores" icon={Layers}>
            <KV k="active sessions"        v={String(sessions.length)} />
            <KV k="session events"          v={String(events.length)} />
            <KV k="notifications"           v={String(notifications.length)} />
            <KV k="unread"                  v={String(unreadCount)} />
            <KV k="last reconnect"          v={lastReconnectAt ? new Date(lastReconnectAt).toLocaleTimeString("tr-TR") : "—"} />
            <KV k="resync"                  v="" actionLabel="Force" onAction={() => requestResync()} />
          </Card>
        </section>

        <section className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-500/[0.05] p-4">
          <div className="flex items-start gap-3">
            <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                Hızlı erişim: <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/60 dark:bg-amber-500/15">⌘⇧T</kbd> Test Launcher · <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/60 dark:bg-amber-500/15">⌘K</kbd> Quick Actions
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                Sol altta 🐛 System Health Panel (canlı log) · sağ altta Demo + Test paneli
              </p>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

// ─── Small atoms ─────────────────────────────────────────────────────────────

function Stat({ label, value, icon: Icon, tone }: {
  label: string
  value: string
  icon: typeof Wifi
  tone: "good" | "warn" | "bad" | "neutral"
}) {
  const TONE = {
    good:    { bg: "bg-emerald-500/10", fg: "text-emerald-700 dark:text-emerald-300" },
    warn:    { bg: "bg-amber-500/10",   fg: "text-amber-700 dark:text-amber-300" },
    bad:     { bg: "bg-rose-500/10",    fg: "text-rose-700 dark:text-rose-300" },
    neutral: { bg: "bg-slate-500/10",   fg: "text-slate-700 dark:text-slate-300" },
  } as const
  const t = TONE[tone]
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", t.bg, t.fg)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
      </div>
    </div>
  )
}

function Card({ title, icon: Icon, children }: {
  title: string
  icon: typeof ShieldCheck
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="p-4 space-y-1.5">{children}</div>
    </div>
  )
}

function KV({ k, v, actionLabel, onAction }: {
  k: string
  v: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-center justify-between text-[11px] font-mono">
      <span className="text-slate-500 dark:text-slate-400">{k}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{v}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-violet-600 dark:text-violet-300 hover:bg-violet-500/10"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
