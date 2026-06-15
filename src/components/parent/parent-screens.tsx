"use client"

import { useEffect, useState } from "react"
import {
  Baby, Sparkles, Clock, Wallet, KeyRound, ChevronRight, LogOut, Phone,
  Copy, CheckCircle2, Loader2, ArrowDownLeft, ArrowUpRight, Gift, ShoppingBag,
} from "lucide-react"
import { ParentQrView } from "./parent-qr-view"
import { ParentPurchaseFlow } from "./parent-purchase-flow"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import {
  listParentActiveSessions, listParentRecentSessions,
  listParentWalletTransactions,
  type WalletTxRow,
} from "@/lib/services/parent-portal.service"
import { formatTime, getStatus, type ActiveSession } from "@/types/aktif-oyun"
import type { ParentBundle } from "@/lib/services/parent-portal.service"
import type { DbSessionRow } from "@/types/realtime"

// ─── Shared helpers ──────────────────────────────────────────────────────────

function fmtTRY(n: number): string {
  return `₺${Math.round(n).toLocaleString("tr-TR")}`
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    const today = new Date()
    const sameDay = d.toDateString() === today.toDateString()
    if (sameDay) return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
  } catch { return iso }
}

function ScreenHeader({ title, subtitle, children }: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="px-5 pt-5 pb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Realtime hook (parent-scoped) ───────────────────────────────────────────

function useParentSessions(parentId: string) {
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading]   = useState(true)
  const [, force] = useState(0)
  const reconnectToken = useReconnectToken()

  // Initial fetch + reconnect-driven re-sync.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listParentActiveSessions(parentId)
      .then((r) => { if (!cancelled) setSessions(r) })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [parentId, reconnectToken])

  // Realtime: any change to *this parent's* sessions → refetch (cheap).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`parent-sessions-${parentId.slice(0, 8)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `parent_id=eq.${parentId}` },
        () => {
          void listParentActiveSessions(parentId).then(setSessions).catch(() => undefined)
        })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [parentId])

  // 1s ticker so countdowns update without re-querying.
  useEffect(() => {
    const id = setInterval(() => force((n) => (n + 1) & 0xffff), 1000)
    return () => clearInterval(id)
  }, [])

  return { sessions, loading }
}

// ─── Home screen ─────────────────────────────────────────────────────────────

interface HomeProps {
  bundle: ParentBundle
}

export function ParentHomeScreen({ bundle }: HomeProps) {
  const { sessions, loading } = useParentSessions(bundle.parent.id)
  const [showPurchase, setShowPurchase] = useState(false)
  const greeting = bundle.parent.full_name.split(" ")[0] ?? "Hoş geldin"

  return (
    <div className="pb-24">
      <ScreenHeader
        title={`Merhaba ${greeting}`}
        subtitle={sessions.length === 0
          ? "Şu an aktif oyun yok"
          : `${sessions.length} aktif oyun · canlı takip`}
      />

      {/* Wallet quick card */}
      <div className="px-5 mb-4">
        <div className="rounded-3xl overflow-hidden p-5 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-xl shadow-violet-500/30 relative">
          <div className="absolute inset-0 opacity-20" aria-hidden style={{
            backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.4), transparent 50%)",
          }} />
          <p className="text-[11px] uppercase tracking-widest font-semibold opacity-70">
            Cüzdan Bakiyesi
          </p>
          <p className="text-4xl font-black tabular-nums mt-1">
            {fmtTRY(Number(bundle.parent.wallet_balance) || 0)}
          </p>
          <p className="text-[11px] opacity-70 mt-2">
            Tesiste tüm ödeme tiplerinde kullanılabilir.
          </p>
        </div>
      </div>

      {/* Quick buy CTA */}
      <div className="px-5 mb-4">
        <button
          type="button"
          onClick={() => setShowPurchase(true)}
          className="w-full rounded-2xl border-2 border-dashed border-violet-300 dark:border-violet-700/60 bg-violet-50/40 dark:bg-violet-500/[0.06] p-4 flex items-center gap-3 text-left hover:bg-violet-50 dark:hover:bg-violet-500/[0.10] transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Önceden paket al</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Telefondan satın al, tesiste kodla giriş yap</p>
          </div>
          <ChevronRight className="w-4 h-4 text-violet-500" />
        </button>
      </div>

      {/* Purchase modal */}
      <ParentPurchaseFlow
        open={showPurchase}
        onClose={() => setShowPurchase(false)}
        bundle={bundle}
        onPurchaseComplete={() => undefined}
      />


      {/* Active sessions */}
      <div className="px-5">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2">
          Şu Anda Oyunda
        </p>
        {loading ? (
          <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 h-24 animate-pulse" />
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
            <Baby className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Çocuğun şu an oyunda değil
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Tesise vardığında kodunu göster, otomatik güncellenir.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => <ActiveSessionRow key={s.id} session={s} />)}
          </ul>
        )}
      </div>

      {/* Children mini-strip */}
      {bundle.children.length > 0 && (
        <div className="px-5 mt-5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2">
            Çocuklar
          </p>
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5 scrollbar-hide">
            {bundle.children.map((c) => (
              <div
                key={c.id}
                className="flex-shrink-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 min-w-[120px]"
              >
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center mb-2">
                  <Baby className="w-4 h-4" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                <p className="text-[11px] text-slate-500">{c.age} yaş</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActiveSessionRow({ session }: { session: ActiveSession }) {
  const status = getStatus(session)
  const isUnlimited = session.totalMinutes === 0
  const isExpiring = status === "expiring"

  const tone = isExpiring
    ? { bg: "from-amber-500/15 to-orange-500/10", border: "border-amber-300 dark:border-amber-700/50", time: "text-amber-700 dark:text-amber-300" }
    : isUnlimited
    ? { bg: "from-fuchsia-500/15 to-purple-500/10", border: "border-fuchsia-300 dark:border-fuchsia-700/50", time: "text-fuchsia-700 dark:text-fuchsia-300" }
    : { bg: "from-emerald-500/15 to-teal-500/10",  border: "border-emerald-300 dark:border-emerald-700/50", time: "text-emerald-700 dark:text-emerald-300" }

  return (
    <li className={cn(
      "rounded-2xl border bg-gradient-to-br p-4 flex items-center gap-3",
      tone.bg, tone.border,
    )}>
      <div className="w-11 h-11 rounded-2xl bg-white/60 dark:bg-slate-900/60 flex items-center justify-center text-violet-600 dark:text-violet-300 flex-shrink-0">
        {isUnlimited ? <Sparkles className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-slate-900 dark:text-white truncate">
          {session.childName}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {isUnlimited ? "Sınırsız paket" : `${session.totalMinutes} dk paket`}
          {isExpiring && " · süre bitiyor"}
        </p>
      </div>
      <div className="text-right">
        <p className={cn("text-2xl font-black tabular-nums leading-none", tone.time)}>
          {isUnlimited ? "∞" : formatTime(session.remainingSeconds)}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
          kalan
        </p>
      </div>
    </li>
  )
}

// ─── Entry-code screen ───────────────────────────────────────────────────────

interface CodeProps {
  bundle: ParentBundle
}

export function ParentCodeScreen({ bundle }: CodeProps) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(bundle.code)
      toast.success("Kod kopyalandı")
    } catch {
      toast.error("Kopyalanamadı")
    }
  }

  return (
    <div className="pb-24">
      <ScreenHeader title="Giriş Kodun" subtitle="Tesiste kasiyere göster" />

      {/* Big code card */}
      <div className="px-5">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-dashed border-violet-300 dark:border-violet-700/60 p-7 shadow-xl shadow-violet-500/[0.05]">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-violet-700 dark:text-violet-300 mb-4">
            <KeyRound className="w-3 h-3" />
            Müşteri Kodu
          </div>

          <p className="font-mono font-black tracking-[0.15em] text-center text-slate-900 dark:text-white text-5xl mb-2">
            {bundle.code}
          </p>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            Tesiste hızlı giriş için kasiyere bu kodu söyle veya göster.
            Kayıt yeniden açılmasına gerek yok.
          </p>

          <button
            type="button"
            onClick={copy}
            className="w-full min-h-[44px] mt-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Kodu Kopyala
          </button>
        </div>

        {/* QR foundation — visual placeholder for the future scan flow */}
        <div className="mt-4">
          <ParentQrView code={bundle.code} />
        </div>
      </div>
    </div>
  )
}

// ─── Wallet screen ───────────────────────────────────────────────────────────

interface WalletProps {
  bundle: ParentBundle
}

export function ParentWalletScreen({ bundle }: WalletProps) {
  const [txs, setTxs] = useState<WalletTxRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listParentWalletTransactions(bundle.parent.id, 30)
      .then((r) => { if (!cancelled) setTxs(r) })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bundle.parent.id, reconnectToken])

  // Live subscription to *this parent's* wallet transactions.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`parent-wallet-${bundle.parent.id.slice(0, 8)}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `parent_id=eq.${bundle.parent.id}` },
        () => {
          void listParentWalletTransactions(bundle.parent.id, 30).then(setTxs).catch(() => undefined)
        })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [bundle.parent.id])

  return (
    <div className="pb-24">
      <ScreenHeader title="Cüzdan" subtitle="Bakiye ve hareketler" />

      {/* Balance hero */}
      <div className="px-5 mb-5">
        <div className="rounded-3xl overflow-hidden p-6 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-xl shadow-violet-500/30 relative">
          <div className="absolute inset-0 opacity-20" aria-hidden style={{
            backgroundImage: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.4), transparent 50%)",
          }} />
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 opacity-80" />
            <p className="text-[11px] uppercase tracking-widest font-semibold opacity-80">
              Bakiye
            </p>
          </div>
          <p className="text-5xl font-black tabular-nums">
            {fmtTRY(Number(bundle.parent.wallet_balance) || 0)}
          </p>
          <p className="text-xs opacity-70 mt-3">
            Tesiste yapacağın ödemelerde kullanılır.
          </p>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-5">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2">
          Son Hareketler
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : !txs || txs.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
            <Wallet className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Henüz hareket yok</p>
            <p className="text-[11px] text-slate-400 mt-1">
              İlk işlemin yapıldığında burada görünecek.
            </p>
          </div>
        ) : (
          <ul className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {txs.map((t) => <WalletTxRowItem key={t.id} tx={t} />)}
          </ul>
        )}
      </div>
    </div>
  )
}

function WalletTxRowItem({ tx }: { tx: WalletTxRow }) {
  const isCredit = tx.type === "load" || tx.type === "refund" || tx.type === "bonus"
  const iconMeta = tx.type === "load"
    ? { Icon: ArrowDownLeft, bg: "bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-400", label: "Yükleme" }
    : tx.type === "refund"
    ? { Icon: ArrowDownLeft, bg: "bg-amber-500/10",   fg: "text-amber-600 dark:text-amber-400",   label: "İade" }
    : tx.type === "bonus"
    ? { Icon: Gift,          bg: "bg-fuchsia-500/10", fg: "text-fuchsia-600 dark:text-fuchsia-400", label: "Bonus" }
    : { Icon: ArrowUpRight,  bg: "bg-slate-500/10",   fg: "text-slate-600 dark:text-slate-400",   label: "Kullanım" }

  const { Icon, bg, fg, label } = iconMeta

  return (
    <li className="px-4 py-3 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", bg, fg)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{label}</p>
          <p className={cn(
            "text-sm font-black tabular-nums flex-shrink-0",
            isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200",
          )}>
            {isCredit ? "+" : "−"}{fmtTRY(tx.amount)}
          </p>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {tx.description || (tx.method === "cash" ? "Nakit" : tx.method === "card" ? "Kart" : "")}
          <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>
          {fmtDate(tx.created_at)}
        </p>
      </div>
    </li>
  )
}

// ─── Profile screen ──────────────────────────────────────────────────────────

interface ProfileProps {
  bundle: ParentBundle
  onSignOut: () => void
}

export function ParentProfileScreen({ bundle, onSignOut }: ProfileProps) {
  const [history, setHistory] = useState<DbSessionRow[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void listParentRecentSessions(bundle.parent.id, 8)
      .then((r) => { if (!cancelled) setHistory(r) })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bundle.parent.id])

  return (
    <div className="pb-24">
      <ScreenHeader title="Profil" subtitle="Hesap ve geçmiş" />

      {/* Identity */}
      <div className="px-5">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-lg font-black flex items-center justify-center flex-shrink-0">
            {bundle.parent.full_name.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {bundle.parent.full_name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" /> {bundle.parent.phone}
            </p>
          </div>
        </div>
      </div>

      {/* Children */}
      {bundle.children.length > 0 && (
        <div className="px-5 mt-5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2">
            Çocuklar
          </p>
          <ul className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {bundle.children.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
                  <Baby className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.age} yaş</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent history */}
      <div className="px-5 mt-5">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2">
          Son Ziyaretler
        </p>
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : !history || history.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-5 text-center">
            <Clock className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Henüz ziyaret kaydı yok</p>
          </div>
        ) : (
          <ul className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {history.map((s) => {
              const date = new Date(s.created_at)
              const isPast = s.status === "completed"
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    isPast ? "bg-slate-500/10 text-slate-500" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  )}>
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {s.child_name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                      <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>
                      {s.duration_minutes === 0 ? "Sınırsız" : `${s.duration_minutes} dk`}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Sign out */}
      <div className="px-5 mt-6">
        <button
          type="button"
          onClick={() => {
            if (confirm("Çıkış yapmak istediğine emin misin?")) onSignOut()
          }}
          className="w-full min-h-[48px] rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-500/[0.05] text-rose-700 dark:text-rose-300 text-sm font-bold flex items-center justify-center gap-2 transition-colors hover:bg-rose-100 dark:hover:bg-rose-500/[0.08]"
        >
          <LogOut className="w-3.5 h-3.5" />
          Çıkış yap
        </button>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-3 px-4 leading-relaxed">
          Tekrar girmek için sadece müşteri kodunu girmen yeterli.
        </p>
      </div>
    </div>
  )
}

export { Loader2 as Spinner }
