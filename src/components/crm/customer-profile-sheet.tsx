"use client"

import { useEffect, useState } from "react"
import {
  Phone, Wallet, Baby, Calendar, X, RefreshCw, AlertTriangle,
  TrendingUp, History, CreditCard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getCustomerProfile } from "@/lib/services/customer.service"
import {
  type CustomerProfile, type CustomerSummary,
  TIER_LABEL, computeTier,
} from "@/types/customer"
import { LoyaltyBadge } from "./loyalty-badge"
import { TagPills } from "./tag-pills"
import { CustomerActivityTimeline } from "./customer-activity-timeline"
import { EmptyState } from "@/components/system/empty-state"
import { useAuth } from "@/contexts/auth-context"

// ─── CustomerProfileSheet ─────────────────────────────────────────────────────
//
// Full-screen-on-mobile, side-drawer-on-desktop profile sheet that displays
// everything we know about a parent. Single RPC round-trip (get_customer_profile)
// pre-bundles summary + children + activity so the open animation never
// stalls on staggered fetches.

interface Props {
  parentId: string | null
  open: boolean
  onClose: () => void
}

function fmtMoney(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

function fmtPhone(p: string): string {
  if (!p) return ""
  const digits = p.replace(/\D/g, "")
  if (digits.length === 11) return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7,9)} ${digits.slice(9)}`
  return p
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }) }
  catch { return iso }
}

export function CustomerProfileSheet({ parentId, open, onClose }: Props) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])

  const canEditTags = !!user && ["super_admin", "admin", "manager"].includes(user.role)

  useEffect(() => {
    if (!open || !parentId) return
    let cancelled = false
    setProfile(null)
    setError(null)

    async function load() {
      try {
        const p = await getCustomerProfile(parentId as string)
        if (cancelled) return
        if (!p) {
          setError("Müşteri bulunamadı")
          return
        }
        setProfile(p)
        setTags(p.summary.tags)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi")
      }
    }

    void load()
    return () => { cancelled = true }
  }, [open, parentId])

  // Escape to close.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const summary = profile?.summary

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className={cn(
        "relative ml-auto w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl",
        "flex flex-col h-full overflow-hidden",
        "animate-[slideInRight_180ms_ease-out]",
      )}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {summary ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {summary.fullName}
                  </h2>
                  <LoyaltyBadge customer={summary} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {fmtPhone(summary.phone)}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span>Kayıt: {fmtDate(summary.registeredAt)}</span>
                </div>
              </>
            ) : (
              <div className="h-7 w-40 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {error ? (
            <EmptyState title="Profil yüklenemedi" body={error} tone="danger" />
          ) : !profile ? (
            <div className="p-5 space-y-3 animate-pulse">
              <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              <div className="grid grid-cols-2 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
              </div>
              <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* KPI grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Kpi label="Ziyaret" value={summary!.visitCount} icon={History} tone="violet" />
                <Kpi label="Harcama" value={fmtMoney(summary!.totalSpent)} icon={TrendingUp} tone="emerald" />
                <Kpi label="Cüzdan" value={fmtMoney(summary!.walletBalance)} icon={Wallet} tone="blue" />
                <Kpi label="Çocuk"   value={summary!.childCount} icon={Baby} tone="amber" />
              </div>

              {/* Refund warning if any */}
              {summary!.refundCount > 0 && (
                <div className="rounded-xl border border-rose-200/70 dark:border-rose-700/50 bg-rose-50/60 dark:bg-rose-500/[0.05] px-4 py-2.5 flex items-center gap-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                  <span className="text-rose-700 dark:text-rose-300 font-semibold">
                    Toplam {summary!.refundCount} iade · {fmtMoney(summary!.refundTotal)}
                  </span>
                </div>
              )}

              {/* Tags */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2">Etiketler</p>
                <TagPills
                  parentId={summary!.id}
                  tags={tags}
                  readOnly={!canEditTags}
                  onChange={setTags}
                />
                {!canEditTags && tags.length === 0 && (
                  <p className="text-[11px] text-slate-400 italic">Etiket yok</p>
                )}
              </div>

              {/* Children */}
              {profile.children.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2">Çocuklar</p>
                  <ul className="space-y-1.5">
                    {profile.children.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
                          <Baby className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{c.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.age} yaş</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Activity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Aktivite</p>
                  <span className="text-[10px] text-slate-400 tabular-nums">son {profile.activity.length}</span>
                </div>
                <CustomerActivityTimeline events={profile.activity} />
              </div>
            </div>
          )}
        </div>

        <style jsx>{`
          @keyframes slideInRight {
            from { transform: translateX(8px); opacity: 0; }
            to   { transform: translateX(0);  opacity: 1; }
          }
        `}</style>
      </aside>
    </div>
  )
}

// ─── KPI tile atom ───────────────────────────────────────────────────────────

function Kpi({ label, value, icon: Icon, tone }: {
  label: string
  value: string | number
  icon: typeof RefreshCw
  tone: "violet" | "emerald" | "blue" | "amber"
}) {
  const tones: Record<string, string> = {
    violet:  "bg-violet-500/10  text-violet-600  dark:text-violet-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    blue:    "bg-blue-500/10    text-blue-600    dark:text-blue-300",
    amber:   "bg-amber-500/10   text-amber-600   dark:text-amber-300",
  }
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 p-3">
      <div className="flex items-center gap-2">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", tones[tone])}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white mt-1">{value}</p>
    </div>
  )
}
