"use client"

import { useEffect, useState } from "react"
import { Activity, ChevronDown, Database, Radio, AlertTriangle, X, Bug } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNetworkStatus } from "@/lib/reliability/network-status"
import { useRealtimeSupervisor } from "@/lib/reliability/realtime-supervisor"
import { useSessionStore } from "@/lib/stores/session-store"
import { useNotificationStore } from "@/lib/stores/notification-store"
import { useBranch } from "@/lib/branch/branch-context"
import { useAuth } from "@/contexts/auth-context"
import { getRecentLogs, type LogEntry } from "@/lib/reliability/logger"

// ─── System Health Panel ─────────────────────────────────────────────────────
//
// A floating dev-only overlay that exposes the internal state of the system.
// Use it during demos and QA to confirm:
//
//   • Realtime channel is healthy
//   • How many active sessions / notifications are in memory
//   • The 20 most recent warn/error log entries
//   • Auth/branch context
//   • Last reconnect token (proves the supervisor fired)
//
// Triggered by a floating button — visible only in dev OR for super_admins.

function formatTs(ms: number | null): string {
  if (!ms) return "—"
  const d = new Date(ms)
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`
}

function ageSeconds(ms: number | null): string {
  if (!ms) return "—"
  return `${Math.max(0, Math.floor((Date.now() - ms) / 1000))}s`
}

export function HealthPanel() {
  const { user } = useAuth()
  // Strict dev-only gate — the health panel exposes raw runtime state that
  // should never bleed into a production deployment, even for admins.
  const isDev = process.env.NODE_ENV !== "production"
  const shouldRender = isDev
  void user  // kept in scope for future hooks (e.g. per-role debug verbosity)

  const [open, setOpen] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [open])
  void tick

  if (!shouldRender) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="System health panel"
        className={cn(
          "fixed bottom-4 left-4 z-40 w-9 h-9 rounded-xl",
          "bg-slate-900/80 dark:bg-white/10 backdrop-blur-md",
          "text-slate-200 hover:text-white",
          "shadow-lg shadow-slate-900/30 dark:shadow-black/40",
          "flex items-center justify-center transition-all",
          open && "ring-2 ring-violet-500",
        )}
      >
        <Bug className="w-4 h-4" />
      </button>

      {open && <HealthPanelDrawer onClose={() => setOpen(false)} />}
    </>
  )
}

function HealthPanelDrawer({ onClose }: { onClose: () => void }) {
  const { online, realtimeConnected, onlineSince, offlineSince, realtimeDownSince } = useNetworkStatus()
  const { reconnectToken, lastReconnectAt } = useRealtimeSupervisor()
  const { sessions, events } = useSessionStore()
  const { notifications, unreadCount } = useNotificationStore()
  const { activeBranch, canSwitch } = useBranch()
  const { user } = useAuth()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logFilter, setLogFilter] = useState<"all" | "warn" | "error">("all")
  const [logsOpen, setLogsOpen] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      const filtered = logFilter === "all"
        ? getRecentLogs()
        : getRecentLogs(logFilter)
      setLogs(filtered.slice(-20).reverse())
    }, 1000)
    return () => clearInterval(id)
  }, [logFilter])

  const errorCount = logs.filter((l) => l.level === "error").length
  const warnCount  = logs.filter((l) => l.level === "warn").length

  return (
    <div className={cn(
      "fixed bottom-16 left-4 z-40 w-[340px] max-h-[80vh]",
      "rounded-2xl border border-slate-200 dark:border-slate-700",
      "bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg",
      "shadow-2xl shadow-slate-900/20 dark:shadow-black/50",
      "overflow-hidden flex flex-col",
      "animate-[fadeInUp_140ms_ease-out]",
    )}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            realtimeConnected && online ? "bg-emerald-500 animate-pulse" : "bg-rose-500",
          )} />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">System Health</h3>
          <span className="text-[10px] font-mono text-slate-400">dev panel</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Network */}
        <Section icon={Radio} title="Network & Realtime">
          <Row k="navigator.onLine" v={online ? "true" : "false"} tone={online ? "good" : "bad"} />
          <Row k="realtime channel" v={realtimeConnected ? "connected" : "down"} tone={realtimeConnected ? "good" : "bad"} />
          <Row k="online since" v={ageSeconds(onlineSince)} />
          {offlineSince && <Row k="offline since" v={ageSeconds(offlineSince)} tone="warn" />}
          {realtimeDownSince && <Row k="rt down since" v={ageSeconds(realtimeDownSince)} tone="warn" />}
          <Row k="reconnect token" v={String(reconnectToken)} />
          <Row k="last reconnect" v={formatTs(lastReconnectAt)} />
        </Section>

        {/* Stores */}
        <Section icon={Database} title="In-memory Stores">
          <Row k="active sessions" v={String(sessions.length)} />
          <Row k="session events" v={String(events.length)} />
          <Row k="notifications" v={String(notifications.length)} />
          <Row k="unread" v={String(unreadCount)} />
        </Section>

        {/* Auth & Branch */}
        <Section icon={Activity} title="Auth & Branch">
          <Row k="user" v={user?.email ?? "—"} />
          <Row k="role" v={user?.role ?? "—"} />
          <Row k="branch" v={activeBranch?.branchName ?? (canSwitch ? "Tüm Şubeler" : "—")} />
          <Row k="branch code" v={activeBranch?.branchCode ?? "—"} />
        </Section>

        {/* Logs */}
        <Section
          icon={AlertTriangle}
          title="Recent Logs"
          badge={errorCount > 0 ? `${errorCount} err` : warnCount > 0 ? `${warnCount} warn` : undefined}
          badgeTone={errorCount > 0 ? "bad" : warnCount > 0 ? "warn" : undefined}
          collapsible
          isOpen={logsOpen}
          onToggle={() => setLogsOpen((v) => !v)}
        >
          <div className="flex gap-1 mb-2">
            {(["all", "warn", "error"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded",
                  logFilter === f
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          {logs.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">no entries</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto -mx-1 px-1">
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded px-2 py-1 font-mono text-[10px]",
                    l.level === "error" && "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300",
                    l.level === "warn"  && "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    (l.level === "info" || l.level === "debug") && "bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400",
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span className="font-bold">[{l.scope}]</span>
                    <span className="opacity-60 ml-auto">{formatTs(l.ts)}</span>
                  </div>
                  <div className="truncate">{l.message}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 font-mono">
        Konsoldan: <code className="text-slate-500">__gkpLogs.recent()</code>
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

// ─── Atoms ───────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, badge, badgeTone, children, collapsible, isOpen, onToggle }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  badge?: string
  badgeTone?: "good" | "warn" | "bad"
  children: React.ReactNode
  collapsible?: boolean
  isOpen?: boolean
  onToggle?: () => void
}) {
  const collapsed = collapsible && !isOpen
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900/50">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          collapsible && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40",
        )}
        onClick={onToggle}
      >
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{title}</span>
        {badge && (
          <span className={cn(
            "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded",
            badgeTone === "bad"  && "bg-rose-500/15 text-rose-700 dark:text-rose-300",
            badgeTone === "warn" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
            badgeTone === "good" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
          )}>
            {badge}
          </span>
        )}
        {collapsible && (
          <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", isOpen && "rotate-180", !badge && "ml-auto")} />
        )}
      </div>
      {!collapsed && <div className="px-3 pb-2 space-y-1">{children}</div>}
    </div>
  )
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="flex items-center justify-between text-[11px] font-mono">
      <span className="text-slate-500 dark:text-slate-400">{k}</span>
      <span className={cn(
        "font-semibold tabular-nums",
        tone === "good" && "text-emerald-700 dark:text-emerald-300",
        tone === "warn" && "text-amber-700 dark:text-amber-300",
        tone === "bad"  && "text-rose-700 dark:text-rose-300",
        !tone && "text-slate-700 dark:text-slate-200",
      )}>
        {v}
      </span>
    </div>
  )
}
