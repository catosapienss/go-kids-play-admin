"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Banknote, CreditCard, Sigma, PackageCheck, ReceiptText, Loader2, AlertCircle, Tag,
  Ban, TriangleAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { listTodayRetailSales, summariseRetailDay, voidSale } from "@/lib/services/retail"
import { useAuth } from "@/contexts/auth-context"
import type { RetailSaleListRow } from "@/types/retail"

// ─── Retail Day Panel — /perakende finance summary + sales feed ──────────────
//
// Staff-visible daily overview: Nakit / Kart / Genel Toplam / Ürün Adedi /
// Satış Sayısı as a compact finance strip, followed by today's sales newest
// first. Split (Karma) payments always show the explicit Nakit+Kart split —
// never just "Karma". Read-only (plain selects under RLS).
//
// `refreshKey` bumps after every checkout so the numbers update immediately
// without waiting for a reload.

const fmt = (n: number) => `₺${Math.round(n).toLocaleString("tr-TR")}`

function fmtHM(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => (n < 10 ? "0" + n : String(n))
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function RetailDayPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useAuth()
  const isManager = user?.role === "manager" || user?.role === "admin" || user?.role === "super_admin"
  const [rows, setRows]   = useState<RetailSaleListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localRefresh, setLocalRefresh] = useState(0)
  const [voidingId, setVoidingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    listTodayRetailSales()
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi") })
    return () => { cancelled = true }
  }, [refreshKey, localRefresh])

  const handleVoid = useCallback(async (r: RetailSaleListRow) => {
    const label = r.itemCount > 0 ? r.itemsLabel : "ürünsüz (hatalı) satış"
    if (!window.confirm(`Bu satışı iptal et?\n\n${fmtHM(r.soldAt)} · ${label} · ${fmt(r.totalAmount)}\n\nTutar toplamlardan düşülecek ve (varsa) stok geri yüklenecek.`)) return
    const reason = window.prompt("İptal sebebi (opsiyonel):", r.itemCount === 0 ? "Hatalı/ürünsüz kayıt" : "") ?? undefined
    setVoidingId(r.id)
    try {
      await voidSale(r.id, reason)
      toast.success("Satış iptal edildi")
      setLocalRefresh((k) => k + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İptal edilemedi")
    } finally {
      setVoidingId(null)
    }
  }, [])

  const stats = useMemo(() => summariseRetailDay(rows ?? []), [rows])

  return (
    <div className="space-y-3">
      {/* ── Finance summary strip ─────────────────────────────────────────── */}
      <div className={cn("grid grid-cols-2 sm:grid-cols-3 gap-2", stats.discountTotal > 0 ? "lg:grid-cols-6" : "lg:grid-cols-5")}>
        <StatCard
          label="Nakit Toplamı"
          value={rows ? fmt(stats.cashTotal) : undefined}
          icon={Banknote}
          tone="emerald"
        />
        <StatCard
          label="Kart Toplamı"
          value={rows ? fmt(stats.cardTotal) : undefined}
          icon={CreditCard}
          tone="sky"
        />
        <StatCard
          label="Genel Toplam"
          value={rows ? fmt(stats.grandTotal) : undefined}
          icon={Sigma}
          tone="violet"
          emphasis
        />
        <StatCard
          label="Satılan Ürün"
          value={rows ? `${stats.itemsSold} adet` : undefined}
          icon={PackageCheck}
          tone="amber"
        />
        <StatCard
          label="Günlük Satış"
          value={rows ? `${stats.saleCount} işlem` : undefined}
          icon={ReceiptText}
          tone="slate"
        />
        {stats.discountTotal > 0 && (
          <StatCard
            label="İndirim"
            value={fmt(stats.discountTotal)}
            icon={Tag}
            tone="amber"
          />
        )}
      </div>

      {/* ── Today's sales feed (newest first) ─────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-900 dark:text-white">Bugünkü Satışlar</p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {rows ? `${rows.length} satış` : "…"}
          </p>
        </div>

        {error ? (
          <div className="px-4 py-6 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : rows === null ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Bugün henüz satış yok</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2 font-bold">Saat</th>
                  <th className="px-4 py-2 font-bold">Ürünler</th>
                  <th className="px-4 py-2 font-bold">Ödeme</th>
                  <th className="px-4 py-2 font-bold text-right pr-5">Tutar</th>
                  {isManager && <th className="px-2 py-2 font-bold text-right pr-4">İşlem</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const phantom = r.itemCount === 0
                  return (
                  <tr key={r.id} className={cn(
                    "border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors",
                    phantom && "bg-amber-50/60 dark:bg-amber-500/[0.06]",
                  )}>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-[12.5px]">
                      {fmtHM(r.soldAt)}
                    </td>
                    <td className="px-4 py-2 text-slate-800 dark:text-slate-200 max-w-[320px]">
                      {phantom ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                          <TriangleAlert className="w-3.5 h-3.5" /> Ürün yok — hatalı kayıt
                        </span>
                      ) : (
                        <span className="truncate block" title={r.itemsLabel}>{r.itemsLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r.paymentMethod === "split" ? (
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          <Chip tone="emerald" icon={Banknote}>{fmt(r.cashAmount)}</Chip>
                          <Chip tone="sky" icon={CreditCard}>{fmt(r.cardAmount)}</Chip>
                        </span>
                      ) : r.paymentMethod === "cash" ? (
                        <Chip tone="emerald" icon={Banknote}>Nakit</Chip>
                      ) : (
                        <Chip tone="sky" icon={CreditCard}>Kart</Chip>
                      )}
                    </td>
                    <td className="px-4 py-2 pr-5 text-right font-bold text-slate-900 dark:text-white">
                      {fmt(r.totalAmount)}
                    </td>
                    {isManager && (
                      <td className="px-2 py-2 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleVoid(r)}
                          disabled={voidingId === r.id}
                          title="Satışı iptal et (yönetici)"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/15 disabled:opacity-50 transition-colors"
                        >
                          {voidingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                          İptal
                        </button>
                      </td>
                    )}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, tone, emphasis,
}: {
  label: string
  value: string | undefined
  icon: typeof Banknote
  tone: "emerald" | "sky" | "violet" | "amber" | "slate"
  emphasis?: boolean
}) {
  const tones: Record<typeof tone, { bg: string; fg: string }> = {
    emerald: { bg: "bg-emerald-100 dark:bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-300" },
    sky:     { bg: "bg-sky-100     dark:bg-sky-500/10",     fg: "text-sky-600     dark:text-sky-300" },
    violet:  { bg: "bg-violet-100  dark:bg-violet-500/10",  fg: "text-violet-600  dark:text-violet-300" },
    amber:   { bg: "bg-amber-100   dark:bg-amber-500/10",   fg: "text-amber-600   dark:text-amber-300" },
    slate:   { bg: "bg-slate-100   dark:bg-slate-800",      fg: "text-slate-600   dark:text-slate-300" },
  }
  return (
    <div className={cn(
      "rounded-2xl border bg-white dark:bg-slate-900 p-3 flex items-center gap-2.5",
      emphasis
        ? "border-violet-300 dark:border-violet-500/40 shadow-sm shadow-violet-500/10"
        : "border-slate-200 dark:border-slate-800",
    )}>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", tones[tone].bg)}>
        <Icon className={cn("w-4 h-4", tones[tone].fg)} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 truncate">
          {label}
        </p>
        <p className="text-base font-black text-slate-900 dark:text-white leading-tight tabular-nums truncate">
          {value ?? <span className="inline-block w-12 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />}
        </p>
      </div>
    </div>
  )
}

function Chip({
  tone, icon: Icon, children,
}: {
  tone: "emerald" | "sky"
  icon: typeof Banknote
  children: React.ReactNode
}) {
  const cls = tone === "emerald"
    ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300"
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold", cls)}>
      <Icon className="w-3 h-3" />
      {children}
    </span>
  )
}
