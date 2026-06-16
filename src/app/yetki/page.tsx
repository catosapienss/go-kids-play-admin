"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle, AlertTriangle, Shield, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { MainLayout } from "@/components/layout/main-layout"
import { useAuth } from "@/contexts/auth-context"
import {
  canAccessRoute, defaultRouteForRole, ROUTE_ROLES, PUBLIC_ROUTES,
} from "@/lib/permissions"
import { ROLE_LABELS, type UserRole, isManagerRole, isStaffRole, isSuperAdmin } from "@/types/auth"

// ─── /yetki — Role & Permission Debug Page ────────────────────────────────────
//
// Internal diagnostic page that explains exactly:
//   • Who is signed in (id, email, fullName)
//   • What role they have, and where it came from (supabase-full /
//     supabase-fallback / auth-only / offline-mode)
//   • Which routes their role can access (live computed against permissions.ts)
//   • The full route-role mapping
//
// Use this whenever a user reports "I should be a Manager but I'm seeing the
// Staff sidebar" — the answer is usually visible at a glance here.

const SOURCE_EXPLAIN: Record<string, { label: string; tone: "ok" | "warn" | "bad"; hint: string }> = {
  "supabase-full":     { label: "Supabase (tam şema)",  tone: "ok",   hint: "profiles tablosundan tüm kolonlar başarıyla yüklendi" },
  "supabase-fallback": { label: "Supabase (eksik kolon)", tone: "warn", hint: "branch_id kolonu eksik — recovery-roles.sql'i çalıştır" },
  "auth-only":         { label: "Sadece auth (profil yok)", tone: "bad", hint: "profiles tablosunda bu kullanıcı için satır yok" },
  "offline-mode":      { label: "Çevrimdışı kurtarma",    tone: "warn", hint: "Supabase erişilemediği için localStorage'dan yüklendi" },
  "none":              { label: "Anonim",                 tone: "bad", hint: "Hiç kullanıcı yok" },
}

export default function RoleDebugPage() {
  const { user, roleSource } = useAuth()
  const [now, setNow] = useState<string>("")

  useEffect(() => {
    setNow(new Date().toLocaleString("tr-TR"))
  }, [])

  if (!user) {
    return (
      <MainLayout title="Yetki Tanı" subtitle="Rol & yetki teşhis ekranı">
        <div className="max-w-3xl mx-auto rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-500/[0.05] p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
            Giriş yapılmamış
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            /login üzerinden giriş yapın.
          </p>
        </div>
      </MainLayout>
    )
  }

  const source = SOURCE_EXPLAIN[roleSource]
  const tone = source.tone === "ok"
    ? { bg: "bg-emerald-500/10",  fg: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/30", icon: CheckCircle2 }
    : source.tone === "warn"
    ? { bg: "bg-amber-500/10",    fg: "text-amber-700 dark:text-amber-300",     ring: "ring-amber-500/30", icon: AlertTriangle }
    : { bg: "bg-rose-500/10",     fg: "text-rose-700 dark:text-rose-300",       ring: "ring-rose-500/30", icon: XCircle }

  const SourceIcon = tone.icon

  return (
    <MainLayout title="Yetki Tanı" subtitle={`Snapshot · ${now}`}>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Top: identity + role source */}
        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-1">
                Giriş yapan kullanıcı
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{user.fullName}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{user.email}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">{user.id}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ring-1",
                "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30",
              )}>
                <Shield className="w-3 h-3" />
                {ROLE_LABELS[user.role]} · {user.role}
              </span>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ring-1",
                tone.bg, tone.fg, tone.ring,
              )}>
                <SourceIcon className="w-2.5 h-2.5" />
                {source.label}
              </span>
            </div>
          </div>

          {source.tone !== "ok" && (
            <div className="mt-4 rounded-xl border border-amber-200/60 dark:border-amber-700/40 bg-amber-50/60 dark:bg-amber-500/[0.05] p-3 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                <strong>Rol kaynağı uyarısı:</strong> {source.hint}
              </p>
            </div>
          )}
        </section>

        {/* Role tier flags */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RoleFlag label="Süper Admin"  active={isSuperAdmin(user.role)} />
          <RoleFlag label="Manager tier" active={isManagerRole(user.role)} />
          <RoleFlag label="Staff tier"   active={isStaffRole(user.role)} />
          <RoleFlag label="Aktif"        active={user.isActive} />
        </section>

        {/* Accessible routes */}
        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Erişim Matrisi</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Her route bu kullanıcının rolüyle açılabilir mi?
            </p>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {Object.entries(ROUTE_ROLES).map(([path, roles]) => {
              const ok = canAccessRoute(path, user.role)
              return (
                <li key={path} className="flex items-center gap-3 px-5 py-2.5">
                  <div className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
                    ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-300",
                  )}>
                    {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  </div>
                  <code className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-200 min-w-[180px]">
                    {path}
                  </code>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-1">
                    izinli roller: {roles.join(" · ")}
                  </span>
                  <span className={cn(
                    "text-[10px] uppercase tracking-widest font-bold",
                    ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
                  )}>
                    {ok ? "Erişebilir" : "Engelli"}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Public routes */}
        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Public Routes</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
            Auth gerektirmeyen yollar — herkes açabilir
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {PUBLIC_ROUTES.map((p) => (
              <code key={p} className="text-[11px] font-mono px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {p}
              </code>
            ))}
          </div>
        </section>

        {/* Diagnostic JSON */}
        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-900 text-slate-100 p-5">
          <h2 className="text-sm font-bold mb-2">Diagnostic JSON</h2>
          <p className="text-[11px] text-slate-400 mb-3">
            Tam state — destek talep ederken kopyala
          </p>
          <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all">
{JSON.stringify({
  user: {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    branchId: user.branchId,
  },
  roleSource,
  roleTier: {
    isSuperAdmin: isSuperAdmin(user.role),
    isManagerRole: isManagerRole(user.role),
    isStaffRole: isStaffRole(user.role),
  },
  defaultRoute: defaultRouteForRole(user.role),
  routesAllowed: Object.keys(ROUTE_ROLES).filter((p) => canAccessRoute(p, user.role)),
  routesDenied:  Object.keys(ROUTE_ROLES).filter((p) => !canAccessRoute(p, user.role)),
}, null, 2)}
          </pre>
        </section>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/70">
          <strong>Bug raporlarken:</strong> bu sayfanın altındaki JSON'u kopyala —
          rol kaynağı, izinler ve etiketler tek bakışta görünür.
        </div>
      </div>
    </MainLayout>
  )
}

function RoleFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-3 flex items-center gap-2.5 transition-colors",
      active
        ? "border-emerald-500/30 bg-emerald-500/[0.08]"
        : "border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900",
    )}>
      <div className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
        active
          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
          : "bg-slate-100 dark:bg-slate-800 text-slate-400",
      )}>
        {active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className={cn(
          "text-sm font-bold",
          active ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400",
        )}>
          {active ? "Evet" : "Hayır"}
        </p>
      </div>
    </div>
  )
}
