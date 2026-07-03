"use client"

import { useEffect, useState } from "react"
import { Receipt, Banknote, CreditCard, Wallet, Loader2, ShoppingBag, Play, Cake } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useDateRange } from "@/lib/reports/date-range-context"

// ─── Recent Transactions Panel ──────────────────────────────────────────────
//
// Tabular feed of every individual revenue event in the active date range.
// Pulls three sources in parallel:
//
//   • payments              (game sessions + extensions)
//   • retail_sales          (over-the-counter products)
//   • organization_payments (birthday deposits / installments / refunds)
//
// Aggregates them into one chronological list so management can scroll
// through the period transaction-by-transaction. Read-only — no inserts,
// no updates, no mutations.

interface Row {
  id:       string
  at:       string                   // ISO
  source:   "session" | "retail" | "birthday"
  label:    string                   // child name / product / org name
  cash:     number
  card:     number
  wallet:   number
  total:    number
  method:   "cash" | "card" | "wallet" | "mixed" | "free"
}

interface PaymentRow {
  id:           string
  session_id:   string | null
  created_at:   string
  cash_amount:  number | string | null
  card_amount:  number | string | null
  wallet_amount:number | string | null
  total_amount: number | string | null
}
interface SessionLite { id: string; child_name: string | null }

interface RetailRow {
  id:           string
  sold_at:      string
  total_amount: number | string | null
  cash_amount:  number | string | null
  card_amount:  number | string | null
  notes:        string | null
  voided:       boolean
}

interface OrgPayRow {
  id:              string
  organization_id: string
  amount:          number | string | null
  method:          "cash" | "card" | "transfer" | "wallet"
  kind:            "deposit" | "installment" | "full" | "refund"
  created_at:      string
}

function num(v: unknown): number {
  if (v == null) return 0
  return typeof v === "number" ? v : Number(v) || 0
}

function pickMethod(c: number, k: number, w: number): Row["method"] {
  const total = c + k + w
  if (total === 0) return "free"
  const non = [c, k, w].filter((v) => v > 0).length
  if (non > 1)  return "mixed"
  if (c > 0)    return "cash"
  if (k > 0)    return "card"
  return "wallet"
}

function fmt(n: number): string { return "₺" + Math.round(n).toLocaleString("tr-TR") }
function fmtDT(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n < 10 ? "0" + n : String(n)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const SOURCE_META: Record<Row["source"], { label: string; cls: string; icon: typeof Receipt }> = {
  session:  { label: "Oturum",     cls: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", icon: Play },
  retail:   { label: "Perakende",  cls: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",         icon: ShoppingBag },
  birthday: { label: "Doğum Günü", cls: "bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300",             icon: Cake },
}

const METHOD_ICON: Record<Row["method"], typeof Banknote | null> = {
  cash:   Banknote,
  card:   CreditCard,
  wallet: Wallet,
  mixed:  null,
  free:   null,
}

export function RecentTransactionsPanel({ limit = 60 }: { limit?: number }) {
  const { range } = useDateRange()
  const [rows, setRows]       = useState<Row[] | null>(null)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null); setError(null)
    const supabase = createClient()
    const fromIso = range.from.toISOString()
    const toIso   = range.to.toISOString()

    async function load() {
      try {
        const [payRes, retailRes, orgPayRes] = await Promise.all([
          supabase.from("payments")
            .select("id, session_id, created_at, cash_amount, card_amount, wallet_amount, total_amount")
            .gte("created_at", fromIso).lte("created_at", toIso)
            .order("created_at", { ascending: false }).limit(limit),
          supabase.from("retail_sales")
            .select("id, sold_at, total_amount, cash_amount, card_amount, notes, voided")
            .gte("sold_at", fromIso).lte("sold_at", toIso)
            .order("sold_at", { ascending: false }).limit(limit),
          supabase.from("organization_payments")
            .select("id, organization_id, amount, method, kind, created_at")
            .gte("created_at", fromIso).lte("created_at", toIso)
            .order("created_at", { ascending: false }).limit(limit),
        ])

        // Resolve session.child_name + org.child_name for nicer labels
        const payments = (payRes.data ?? []) as PaymentRow[]
        const retail   = (retailRes.data ?? []) as RetailRow[]
        const orgPays  = (orgPayRes.data ?? []) as OrgPayRow[]

        const sessionIds = payments.map((p) => p.session_id).filter((id): id is string => !!id)
        const orgIds     = orgPays.map((p) => p.organization_id)
        const retailIds  = retail.filter((r) => !r.voided).map((r) => r.id)
        const [sessionsRes, orgsRes, itemsRes] = await Promise.all([
          sessionIds.length
            ? supabase.from("sessions").select("id, child_name").in("id", sessionIds)
            : Promise.resolve({ data: [] }),
          orgIds.length
            ? supabase.from("organizations").select("id, child_name").in("id", orgIds)
            : Promise.resolve({ data: [] }),
          retailIds.length
            ? supabase.from("retail_sale_items").select("sale_id, product_name, quantity").in("sale_id", retailIds)
            : Promise.resolve({ data: [] }),
        ])
        const sessionMap = new Map((sessionsRes.data as SessionLite[] ?? []).map((s) => [s.id, s.child_name ?? "—"]))
        const orgMap     = new Map((orgsRes.data as { id: string; child_name: string }[] ?? []).map((o) => [o.id, o.child_name]))

        // Aggregate line items per sale so retail rows say "Çorap × 2 · Boyama × 1"
        // instead of just "Perakende".
        const retailItemsMap = new Map<string, string>()
        for (const it of (itemsRes.data as { sale_id: string; product_name: string | null; quantity: number | string | null }[] ?? [])) {
          const qty = Number(it.quantity ?? 1) || 1
          const name = (it.product_name ?? "Ürün").trim() || "Ürün"
          const label = qty > 1 ? `${name} × ${qty}` : name
          const prev = retailItemsMap.get(it.sale_id)
          retailItemsMap.set(it.sale_id, prev ? `${prev} · ${label}` : label)
        }

        const collected: Row[] = []
        for (const p of payments) {
          const c = num(p.cash_amount), k = num(p.card_amount), w = num(p.wallet_amount)
          collected.push({
            id:     "p_" + p.id,
            at:     p.created_at,
            source: "session",
            label:  p.session_id ? (sessionMap.get(p.session_id) ?? "Oturum") : "Oturum",
            cash: c, card: k, wallet: w,
            total:  num(p.total_amount),
            method: pickMethod(c, k, w),
          })
        }
        for (const r of retail) {
          if (r.voided) continue
          const c = num(r.cash_amount), k = num(r.card_amount)
          // Prefer the actual line-items ("Çorap × 2 · Boyama × 1"). Fall
          // back to the sale's free-text note, then a generic "Perakende".
          const label = retailItemsMap.get(r.id) ?? r.notes ?? "Perakende"
          collected.push({
            id:     "r_" + r.id,
            at:     r.sold_at,
            source: "retail",
            label,
            cash: c, card: k, wallet: 0,
            total:  num(r.total_amount),
            method: pickMethod(c, k, 0),
          })
        }
        for (const o of orgPays) {
          const amt = num(o.amount)
          const c = o.method === "cash"   ? amt : 0
          const k = o.method === "card"   ? amt : 0
          const w = o.method === "wallet" ? amt : 0
          collected.push({
            id:     "o_" + o.id,
            at:     o.created_at,
            source: "birthday",
            label:  (orgMap.get(o.organization_id) ?? "Organizasyon") + " · " +
                    (o.kind === "deposit" ? "Kapora" : o.kind === "installment" ? "Taksit" : o.kind === "full" ? "Tam" : "İade"),
            cash: c, card: k, wallet: w,
            total:  o.kind === "refund" ? -amt : amt,
            method: o.method === "transfer" ? "mixed" : (o.method as Row["method"]),
          })
        }
        collected.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        if (!cancelled) setRows(collected.slice(0, limit))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi")
      }
    }
    void load()
    return () => { cancelled = true }
  }, [range.from, range.to, limit])

  const totalSum = rows ? rows.reduce((s, r) => s + r.total, 0) : 0

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Geçmiş İşlemler</h2>
            <p className="text-[11px] text-slate-500">Seçili aralıkta tüm ödemeler</p>
          </div>
        </div>
        {rows && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Toplam · {rows.length} satır</p>
            <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">{fmt(totalSum)}</p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Th>Zaman</Th>
              <Th>Kaynak</Th>
              <Th>Detay</Th>
              <Th className="text-right">Nakit</Th>
              <Th className="text-right">Kart</Th>
              <Th className="text-right">Cüzdan</Th>
              <Th className="text-right pr-5">Toplam</Th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error ? (
              <tr><td colSpan={7} className="py-8 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="py-8 text-center text-rose-500 text-sm">{error}</td></tr>
            ) : rows && rows.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm">Bu aralıkta işlem yok</td></tr>
            ) : rows && rows.map((r) => {
              const M = SOURCE_META[r.source]
              const MIcon = METHOD_ICON[r.method]
              return (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap text-[12.5px]">{fmtDT(r.at)}</td>
                  <td className="px-4 py-2">
                    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold", M.cls)}>
                      <M.icon className="w-3 h-3" />
                      {M.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[280px]">
                    <span className="inline-flex items-center gap-1.5">
                      {MIcon && <MIcon className="w-3 h-3 text-slate-400" />}
                      {r.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">{r.cash > 0 ? fmt(r.cash) : "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">{r.card > 0 ? fmt(r.card) : "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">{r.wallet > 0 ? fmt(r.wallet) : "—"}</td>
                  <td className={cn("px-4 py-2 pr-5 text-right font-bold", r.total < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white")}>{fmt(r.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2 font-bold whitespace-nowrap", className)}>{children}</th>
}
