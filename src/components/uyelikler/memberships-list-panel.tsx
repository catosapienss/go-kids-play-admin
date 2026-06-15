"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Sparkles, Pause, Play, X, Filter, Plus, Loader2,
  Calendar, Clock, Ticket, CreditCard,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  listAllMemberships, pauseMembership, resumeMembership, cancelMembership,
} from "@/lib/services/membership.service"
import {
  TYPE_LABEL, TYPE_TONE, canPause, canResume, daysRemaining,
  type Membership, type MembershipType, type MembershipStatus,
} from "@/types/membership"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { useAuth } from "@/contexts/auth-context"
import { EmptyState } from "@/components/system/empty-state"
import { PanelSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { MembershipStatusBadge } from "./membership-status-badge"
import { MembershipCreateDialog } from "./membership-create-dialog"

// ─── Memberships List Panel ──────────────────────────────────────────────────
//
// Admin-facing list of every membership in the branch. Filters by status +
// type. Inline actions: pause, resume, cancel. "Yeni Üyelik" opens a create
// modal.

const TYPE_FILTERS: Array<{ id: "all" | MembershipType; label: string }> = [
  { id: "all",        label: "Tümü" },
  { id: "unlimited",  label: TYPE_LABEL.unlimited },
  { id: "monthly",    label: TYPE_LABEL.monthly },
  { id: "punch_pass", label: TYPE_LABEL.punch_pass },
  { id: "timed",      label: TYPE_LABEL.timed },
]

const STATUS_FILTERS: Array<{ id: "all" | MembershipStatus; label: string }> = [
  { id: "all",      label: "Tümü" },
  { id: "active",   label: "Aktif" },
  { id: "paused",   label: "Duraklatılan" },
  { id: "expired",  label: "Süresi Doldu" },
  { id: "cancelled",label: "İptal" },
]

const TYPE_ICON: Record<MembershipType, typeof Sparkles> = {
  unlimited:  Sparkles,
  monthly:    CreditCard,
  punch_pass: Ticket,
  timed:      Clock,
}

interface ParentMap { [id: string]: { name: string; phone: string } }

interface Props {
  /** Optional: when provided, list is scoped to this parent only. */
  parentId?: string
}

export function MembershipsListPanel({ parentId }: Props) {
  const { user } = useAuth()
  const [rows, setRows]       = useState<Membership[] | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [tFilter, setT]       = useState<typeof TYPE_FILTERS[number]["id"]>("all")
  const [sFilter, setS]       = useState<typeof STATUS_FILTERS[number]["id"]>("all")
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [parents, setParents] = useState<ParentMap>({})
  const reconnectToken = useReconnectToken()

  const canManage = !!user && ["super_admin", "admin", "manager"].includes(user.role)

  const refresh = async () => {
    try {
      const all = await listAllMemberships({ limit: 200 })
      const scoped = parentId ? all.filter((m) => m.parentId === parentId) : all
      setRows(scoped)
      // Lazy-hydrate parent names for the rows we care about.
      const ids = Array.from(new Set(scoped.map((m) => m.parentId)))
      if (ids.length && !parentId) {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data } = await supabase.from("parents").select("id, full_name, phone").in("id", ids)
        const map: ParentMap = {}
        for (const p of data ?? []) map[p.id as string] = { name: p.full_name as string, phone: p.phone as string }
        setParents(map)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi")
    }
  }

  useEffect(() => {
    setRows(null); setError(null)
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId, reconnectToken])

  const filtered = useMemo(() => {
    return (rows ?? []).filter((m) =>
      (tFilter === "all" || m.type   === tFilter) &&
      (sFilter === "all" || m.status === sFilter),
    )
  }, [rows, tFilter, sFilter])

  async function handlePause(m: Membership) {
    if (pending) return
    const reason = prompt("Duraklatma nedeni (opsiyonel):") ?? undefined
    setPending(m.id)
    try {
      await pauseMembership(m.id, reason)
      toast.success("Üyelik duraklatıldı")
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duraklatılamadı")
    } finally { setPending(null) }
  }

  async function handleResume(m: Membership) {
    if (pending) return
    setPending(m.id)
    try {
      await resumeMembership(m.id)
      toast.success("Üyelik devam ediyor")
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Devam ettirilemedi")
    } finally { setPending(null) }
  }

  async function handleCancel(m: Membership) {
    if (pending) return
    if (!confirm("Bu üyeliği iptal etmek istediğine emin misin?")) return
    setPending(m.id)
    try {
      await cancelMembership(m.id, "manual")
      toast.success("Üyelik iptal edildi")
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İptal başarısız")
    } finally { setPending(null) }
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Üyelikler</h3>
          <span className="text-[11px] text-slate-400 tabular-nums">{rows?.length ?? "—"} satır</span>
          {canManage && !parentId && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 transition-colors"
            >
              <Plus className="w-3 h-3" /> Yeni Üyelik
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
          <FilterChips current={tFilter} options={TYPE_FILTERS}   onPick={setT} />
          <FilterChips current={sFilter} options={STATUS_FILTERS} onPick={setS} />
        </div>

        {/* List */}
        {!rows && !error ? (
          <PanelSkeleton height={240} />
        ) : error ? (
          <EmptyState title="Üyelik verisi okunamadı" body={error} tone="danger" />
        ) : filtered.length === 0 ? (
          <EmptyState title="Bu filtreyle üyelik yok" body="Filtreyi gevşeterek veya yeni bir üyelik oluşturarak başlayabilirsin." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filtered.map((m) => {
              const Icon = TYPE_ICON[m.type]
              const tone = TYPE_TONE[m.type]
              const dr = daysRemaining(m)
              const isPending = pending === m.id
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center flex-shrink-0",
                    tone.gradient,
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {parents[m.parentId]?.name ?? "—"}
                      </p>
                      <MembershipStatusBadge membership={m} />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className={tone.fg}>{TYPE_LABEL[m.type]}</span>
                      {m.endsAt && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <Calendar className="w-2.5 h-2.5" />
                          {dr === 0 ? "bugün biter" : dr ? `${dr} gün kaldı` : new Date(m.endsAt).toLocaleDateString("tr-TR")}
                        </>
                      )}
                      {m.type === "punch_pass" && m.remainingUses !== null && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          {m.remainingUses}/{m.totalUses} kullanım
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canPause(m) && (
                        <ActionBtn label="Duraklat" onClick={() => handlePause(m)} pending={isPending} icon={Pause} tone="amber" />
                      )}
                      {canResume(m) && (
                        <ActionBtn label="Devam et" onClick={() => handleResume(m)} pending={isPending} icon={Play} tone="emerald" />
                      )}
                      {(m.status === "active" || m.status === "paused") && (
                        <ActionBtn label="İptal" onClick={() => handleCancel(m)} pending={isPending} icon={X} tone="rose" />
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <MembershipCreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); void refresh() }}
      />
    </>
  )
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function FilterChips<T extends string>({ current, options, onPick }: {
  current: T
  options: Array<{ id: T; label: string }>
  onPick: (id: T) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onPick(o.id)}
          className={cn(
            "text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap transition-colors",
            current === o.id
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const ACTION_TONE: Record<string, string> = {
  amber:   "text-amber-600   dark:text-amber-300   hover:bg-amber-500/10",
  emerald: "text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/10",
  rose:    "text-rose-600    dark:text-rose-300    hover:bg-rose-500/10",
}

function ActionBtn({ label, onClick, pending, icon: Icon, tone }: {
  label: string
  onClick: () => void
  pending: boolean
  icon: typeof Pause
  tone: keyof typeof ACTION_TONE
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={label}
      aria-label={label}
      className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40",
        ACTION_TONE[tone],
      )}
    >
      {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
    </button>
  )
}
