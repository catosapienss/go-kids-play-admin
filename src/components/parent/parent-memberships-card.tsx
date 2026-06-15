"use client"

import { useEffect, useState } from "react"
import {
  Sparkles, CreditCard, Ticket, Clock, Pause, Calendar, AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  listParentMemberships,
} from "@/lib/services/membership.service"
import {
  TYPE_LABEL, TYPE_TONE, STATUS_LABEL, STATUS_TONE,
  daysRemaining, isExpiringSoon,
  type Membership, type MembershipType,
} from "@/types/membership"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { createClient } from "@/lib/supabase/client"

// ─── Parent Memberships Card ──────────────────────────────────────────────────
//
// Sürünür bir banner gibi davranır:  parent has *no* memberships → renders nothing.
// Aktif membership(ler) varsa "Sınırsız" / "Aylık" / "Kontörlü" rozetli premium
// card görünür, üzerinde kalan gün veya kalan kullanım hakkı.
//
// Realtime: anything that changes the parent's memberships table refetches.

const TYPE_ICON: Record<MembershipType, typeof Sparkles> = {
  unlimited:  Sparkles,
  monthly:    CreditCard,
  punch_pass: Ticket,
  timed:      Clock,
}

interface Props {
  parentId: string
}

export function ParentMembershipsCard({ parentId }: Props) {
  const [rows, setRows] = useState<Membership[]>([])
  const [loaded, setLoaded] = useState(false)
  const reconnectToken = useReconnectToken()

  // Fetch
  useEffect(() => {
    let cancelled = false
    void listParentMemberships(parentId)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [parentId, reconnectToken])

  // Realtime: subscribe to any row change for this parent.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`parent-memberships-${parentId.slice(0, 8)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "memberships", filter: `parent_id=eq.${parentId}` },
        () => {
          void listParentMemberships(parentId).then(setRows).catch(() => undefined)
        })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [parentId])

  const active = rows.filter((m) => m.status === "active" || m.status === "paused")
  if (!loaded || active.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
        <Sparkles className="w-2.5 h-2.5" />
        Aktif Üyelikler · {active.length}
      </p>
      {active.map((m) => <MembershipCard key={m.id} membership={m} />)}
    </div>
  )
}

function MembershipCard({ membership: m }: { membership: Membership }) {
  const Icon = TYPE_ICON[m.type]
  const tone = TYPE_TONE[m.type]
  const dr = daysRemaining(m)
  const expiring = isExpiringSoon(m)
  const paused = m.status === "paused"

  return (
    <div className={cn(
      "rounded-3xl overflow-hidden p-5 text-white shadow-xl relative bg-gradient-to-br",
      tone.gradient,
      paused && "opacity-90",
    )}>
      <div className="absolute inset-0 opacity-20" aria-hidden style={{
        backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.4), transparent 50%)",
      }} />

      <div className="relative flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[11px] uppercase tracking-widest font-bold opacity-80">
              {TYPE_LABEL[m.type]} Üyelik
            </p>
            {paused && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-bold uppercase tracking-wider">
                <Pause className="w-2.5 h-2.5" />
                Duraklatıldı
              </span>
            )}
            {expiring && !paused && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/30 text-[9px] font-bold uppercase tracking-wider">
                <AlertTriangle className="w-2.5 h-2.5" />
                Yakında Bitiyor
              </span>
            )}
          </div>

          {/* Main display: days remaining OR uses remaining */}
          {m.type === "punch_pass" ? (
            <p className="text-3xl font-black tabular-nums mt-1">
              {m.remainingUses ?? 0}
              <span className="text-base opacity-70 font-bold ml-1">/ {m.totalUses ?? 0} hak</span>
            </p>
          ) : dr !== null ? (
            <p className="text-3xl font-black tabular-nums mt-1">
              {dr}
              <span className="text-base opacity-70 font-bold ml-1">gün kaldı</span>
            </p>
          ) : (
            <p className="text-3xl font-black tabular-nums mt-1">∞</p>
          )}

          <div className="flex items-center gap-2 mt-2 text-[11px] opacity-80">
            <Calendar className="w-3 h-3" />
            {m.endsAt
              ? `${new Date(m.startedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} → ${new Date(m.endsAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}`
              : `${new Date(m.startedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}`}
          </div>

          {m.notes && (
            <p className="text-[11px] opacity-80 mt-1.5 italic">&ldquo;{m.notes}&rdquo;</p>
          )}
        </div>
      </div>

      {paused && m.type === "unlimited" && (
        <div className="relative mt-3 pt-3 border-t border-white/20 flex items-center gap-1.5 text-[11px] opacity-90">
          <span className="font-bold">Duraklatıldı:</span>
          Tesise vardığında kasiyere söyle, devam ettirelim.
        </div>
      )}
    </div>
  )
}

// Lookup helper exposed for the status pill chip used elsewhere.
export { STATUS_LABEL, STATUS_TONE }
