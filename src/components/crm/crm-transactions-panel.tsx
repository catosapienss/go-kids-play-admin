"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Search, Calendar, Loader2, Baby, User, Phone, Clock, Package,
  Banknote, CreditCard, Wallet, Download, StickyNote, ShoppingBag, Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useMask } from "@/lib/presentation/presentation-mode"

// ─── CRM Transactions Panel ─────────────────────────────────────────────────
//
// Unified operational ledger for the selected date range: play SESSIONS and
// RETAIL SALES in one chronological list. Read-only.
//
// Columns: Çocuk/Ürün · Veli · Telefon · Paket · Tarih · Giriş · Çıkış · Süre ·
//          Ücret · Ödeme. The top-right total shows the period revenue plus a
//          cash / card tender split.

type Method = "cash" | "card" | "wallet" | "mixed" | "free"

interface Row {
  id:            string
  kind:          "session" | "retail"
  at:            string            // start_time (session) | sold_at (retail)
  label:         string            // child name | product summary ("Çorap × 2")
  parentName:    string | null
  parentPhone:   string | null
  durationMin:   number | null     // null for retail
  entryTime:     string | null
  exitTime:      string | null
  total:         number
  cash:          number
  card:          number
  wallet:        number
  method:        Method
  childNotes:    string | null
  discountAmount: number           // retail line discount (0 for sessions)
}

const METHOD_META: Record<Method, { label: string; cls: string; icon?: typeof Banknote }> = {
  cash:   { label: "Nakit",     icon: Banknote,   cls: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  card:   { label: "Kart",      icon: CreditCard, cls: "bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  wallet: { label: "Cüzdan",    icon: Wallet,     cls: "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  mixed:  { label: "Karma",                       cls: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  free:   { label: "Ücretsiz",                    cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
}

function pad(n: number): string { return n < 10 ? "0" + n : String(n) }
function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}
function fmtHM(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtMoney(n: number): string {
  return "₺" + Math.round(n).toLocaleString("tr-TR")
}
function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function num(v: unknown): number { return v == null ? 0 : (typeof v === "number" ? v : Number(v) || 0) }

function pickMethod(cash: number, card: number, wallet: number): Method {
  const total = cash + card + wallet
  if (total === 0) return "free"
  const active = [cash, card, wallet].filter((v) => v > 0).length
  if (active > 1) return "mixed"
  if (cash > 0)   return "cash"
  if (card > 0)   return "card"
  return "wallet"
}

export function CrmTransactionsPanel() {
  const today  = todayIso()
  const mask = useMask()
  const [from, setFrom]     = useState<string>(today)
  const [to,   setTo]       = useState<string>(today)
  const [phone, setPhone]   = useState<string>("")
  const [rows, setRows]     = useState<Row[] | null>(null)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null); setError(null)

    async function load() {
      try {
        const supabase = createClient()
        const fromIso = new Date(from + "T00:00:00").toISOString()
        const toIso   = new Date(to   + "T23:59:59.999").toISOString()
        const phoneFilter = phone.replace(/\D/g, "")
        const hasPhoneFilter = phoneFilter.length >= 3

        // ── Sessions ──────────────────────────────────────────────────────
        let sq = supabase
          .from("sessions")
          .select("id, child_name, parent_name, parent_phone, duration_minutes, start_time, end_time, ended_at")
          .gte("start_time", fromIso)
          .lte("start_time", toIso)
          .order("start_time", { ascending: false })
          .limit(400)
        if (hasPhoneFilter) sq = sq.ilike("parent_phone", `%${phoneFilter}%`)

        // ── Retail sales (skip when filtering by phone — retail has none) ──
        const retailReq = hasPhoneFilter
          ? Promise.resolve({ data: [] as unknown[], error: null })
          : supabase
              .from("retail_sales")
              .select("*")
              .gte("sold_at", fromIso)
              .lte("sold_at", toIso)
              .order("sold_at", { ascending: false })
              .limit(400)

        const [{ data: sessions, error: sErr }, retailRes] = await Promise.all([sq, retailReq])
        if (sErr) throw sErr

        const sList = (sessions ?? []) as Array<{
          id: string; child_name: string | null; parent_name: string | null; parent_phone: string | null
          duration_minutes: number; start_time: string; end_time: string | null; ended_at: string | null
        }>

        // ── Session payments + note snapshots ─────────────────────────────
        const sIds = sList.map((s) => s.id)
        const payMap = new Map<string, { total: number; cash: number; card: number; wallet: number; method: Method }>()
        const noteMap = new Map<string, string>()
        if (sIds.length > 0) {
          const [{ data: pays }, notesRes] = await Promise.all([
            supabase.from("payments")
              .select("session_id, cash_amount, card_amount, wallet_amount, total_amount")
              .in("session_id", sIds),
            supabase.from("sessions").select("id, child_notes").in("id", sIds),
          ])
          for (const p of (pays ?? []) as Array<Record<string, unknown>>) {
            const sid = p.session_id as string
            const cash = num(p.cash_amount), card = num(p.card_amount), wallet = num(p.wallet_amount)
            const total = num(p.total_amount) || cash + card + wallet
            const prev = payMap.get(sid)
            if (prev) {
              const c = prev.cash + cash, k = prev.card + card, w = prev.wallet + wallet
              payMap.set(sid, { total: prev.total + total, cash: c, card: k, wallet: w, method: pickMethod(c, k, w) })
            } else {
              payMap.set(sid, { total, cash, card, wallet, method: pickMethod(cash, card, wallet) })
            }
          }
          if (!notesRes.error) {
            for (const n of (notesRes.data ?? []) as Array<{ id: string; child_notes: string | null }>) {
              if (n.child_notes?.trim()) noteMap.set(n.id, n.child_notes.trim())
            }
          }
        }

        // ── Retail item labels + per-sale discount ────────────────────────
        const retail = ((retailRes.data ?? []) as Array<Record<string, unknown>>).filter((r) => !r.voided)
        const rIds = retail.map((r) => r.id as string)
        const itemLabel = new Map<string, string>()
        const itemDiscount = new Map<string, number>()
        if (rIds.length > 0) {
          const { data: items } = await supabase
            .from("retail_sale_items")
            .select("sale_id, product_name, quantity, discount_amount")
            .in("sale_id", rIds)
          for (const it of (items ?? []) as Array<Record<string, unknown>>) {
            const sid = it.sale_id as string
            const qty = num(it.quantity) || 1
            const name = ((it.product_name as string) ?? "Ürün").trim() || "Ürün"
            const label = qty > 1 ? `${name} × ${qty}` : name
            itemLabel.set(sid, itemLabel.has(sid) ? `${itemLabel.get(sid)} · ${label}` : label)
            itemDiscount.set(sid, (itemDiscount.get(sid) ?? 0) + num(it.discount_amount))
          }
        }

        if (cancelled) return

        const sessionRows: Row[] = sList.map((s) => {
          const t = payMap.get(s.id)
          return {
            id: "s_" + s.id, kind: "session", at: s.start_time,
            label: s.child_name || "—", parentName: s.parent_name, parentPhone: s.parent_phone,
            durationMin: s.duration_minutes, entryTime: s.start_time, exitTime: s.ended_at ?? s.end_time,
            total: t?.total ?? 0, cash: t?.cash ?? 0, card: t?.card ?? 0, wallet: t?.wallet ?? 0,
            method: t?.method ?? "free", childNotes: noteMap.get(s.id) ?? null, discountAmount: 0,
          }
        })

        const retailRows: Row[] = retail.map((r) => {
          const id = r.id as string
          const cash = num(r.cash_amount), card = num(r.card_amount)
          return {
            id: "r_" + id, kind: "retail", at: r.sold_at as string,
            label: itemLabel.get(id) ?? ((r.notes as string | null) ?? "Perakende"),
            parentName: "Perakende", parentPhone: null, durationMin: null,
            entryTime: null, exitTime: null,
            total: num(r.total_amount), cash, card, wallet: 0,
            method: pickMethod(cash, card, 0), childNotes: null,
            discountAmount: itemDiscount.get(id) ?? num(r.discount_total),
          }
        })

        const merged = [...sessionRows, ...retailRows]
          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        setRows(merged)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi")
      }
    }

    void load()
    return () => { cancelled = true }
  }, [from, to, phone])

  // Period totals + tender split (sessions + retail).
  const totals = useMemo(() => {
    const r = rows ?? []
    return {
      count: r.length,
      grand: r.reduce((s, x) => s + x.total, 0),
      cash:  r.reduce((s, x) => s + x.cash, 0),
      card:  r.reduce((s, x) => s + x.card, 0),
      wallet: r.reduce((s, x) => s + x.wallet, 0),
      retailCount: r.filter((x) => x.kind === "retail").length,
    }
  }, [rows])

  function exportCsv() {
    if (!rows || rows.length === 0) return
    const header = ["Tür","Çocuk/Ürün","Veli","Telefon","Paket","Tarih","Giriş","Çıkış","Süre (dk)","İndirim","Ücret","Ödeme","Not"]
    const lines = rows.map((r) => [
      r.kind === "retail" ? "Perakende" : "Oturum",
      r.label,
      r.parentName ?? "",
      r.parentPhone ?? "",
      r.durationMin == null ? "" : r.durationMin === 0 ? "Sınırsız" : `${r.durationMin} dk`,
      fmtDate(r.at),
      fmtHM(r.entryTime),
      fmtHM(r.exitTime),
      r.durationMin == null ? "" : String(r.durationMin),
      r.discountAmount > 0 ? String(r.discountAmount) : "",
      String(r.total),
      r.method === "mixed"
        ? [r.cash > 0 ? `Nakit ${r.cash}` : null, r.card > 0 ? `Kart ${r.card}` : null, r.wallet > 0 ? `Cüzdan ${r.wallet}` : null].filter(Boolean).join(" + ")
        : METHOD_META[r.method].label,
      r.childNotes ?? "",
    ].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `hareketler_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Filter bar */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
            <Calendar className="w-3 h-3" />
          </div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 tabular-nums focus:outline-none focus:border-violet-500" />
          <span className="text-slate-400 text-xs">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 tabular-nums focus:outline-none focus:border-violet-500" />
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon ile ara…"
            className="flex-1 text-xs font-semibold bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 tabular-nums focus:outline-none focus:border-violet-500" />
        </div>

        {/* Total + tender split */}
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Toplam {rows ? `· ${totals.count} işlem` : ""}
          </p>
          <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums leading-tight">
            {rows ? fmtMoney(totals.grand) : "…"}
          </p>
          {rows && (
            <p className="text-[10.5px] font-semibold tabular-nums mt-0.5 flex items-center justify-end gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">Nakit {fmtMoney(totals.cash)}</span>
              <span className="text-sky-600 dark:text-sky-400">Kart {fmtMoney(totals.card)}</span>
              {totals.wallet > 0 && <span className="text-violet-600 dark:text-violet-400">Cüzdan {fmtMoney(totals.wallet)}</span>}
            </p>
          )}
        </div>

        <button type="button" onClick={exportCsv} disabled={!rows || rows.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed">
          <Download className="w-3 h-3" />
          CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 sticky top-0">
            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Th icon={Baby}>Çocuk / Ürün</Th>
              <Th icon={User}>Veli</Th>
              <Th icon={Phone}>Telefon</Th>
              <Th icon={Package}>Paket</Th>
              <Th icon={Calendar}>Tarih</Th>
              <Th>Giriş</Th>
              <Th>Çıkış</Th>
              <Th className="text-right"><Clock className="w-3 h-3 inline mr-1" />Süre</Th>
              <Th className="text-right">Ücret</Th>
              <Th className="text-right pr-4">Ödeme</Th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error ? (
              <tr><td colSpan={10} className="py-10 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></td></tr>
            ) : error ? (
              <tr><td colSpan={10} className="py-10 text-center text-rose-500 text-sm">{error}</td></tr>
            ) : rows && rows.length === 0 ? (
              <tr><td colSpan={10} className="py-12 text-center text-slate-400 text-sm">Bu aralıkta hareket yok</td></tr>
            ) : rows && rows.map((r) => {
              const meta = METHOD_META[r.method]
              const MIcon = meta.icon
              const isRetail = r.kind === "retail"
              return (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-2 max-w-[200px]">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white truncate">
                      {isRetail && <ShoppingBag className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      <span className="truncate">{isRetail ? r.label : (mask.name(r.label) || "—")}</span>
                      {r.discountAmount > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 flex-shrink-0" title="İndirimli">
                          <Tag className="w-2.5 h-2.5" />−{fmtMoney(r.discountAmount)}
                        </span>
                      )}
                    </span>
                    {r.childNotes && (
                      <span className="flex items-start gap-1 mt-0.5" title={r.childNotes}>
                        <StickyNote className="w-2.5 h-2.5 text-amber-500 flex-shrink-0 mt-[1px]" />
                        <span className="text-[10.5px] font-medium text-amber-700 dark:text-amber-400 truncate">{r.childNotes}</span>
                      </span>
                    )}
                  </td>
                  <td className={cn("px-3 py-2 truncate max-w-[140px]", isRetail ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-700 dark:text-slate-300")}>
                    {isRetail ? "Perakende" : (mask.name(r.parentName) || "—")}
                  </td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-[12.5px] whitespace-nowrap">
                    {r.parentPhone ? (mask.enabled ? mask.phone(r.parentPhone) : r.parentPhone) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.durationMin == null ? <span className="text-slate-300 dark:text-slate-600">—</span> : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {r.durationMin === 0 ? "Sınırsız" : `${r.durationMin} dk`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{fmtDate(r.at)}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{fmtHM(r.entryTime)}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{fmtHM(r.exitTime)}</td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300 font-semibold">
                    {r.durationMin == null ? "—" : r.durationMin === 0 ? "∞" : `${r.durationMin} dk`}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                    {r.total > 0 ? fmtMoney(r.total) : "—"}
                  </td>
                  <td className="px-3 py-2 pr-4 text-right">
                    {r.method === "mixed" ? (
                      <span className="inline-flex items-center gap-1 flex-wrap justify-end">
                        {r.cash > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            <Banknote className="w-3 h-3" />N {fmtMoney(r.cash)}
                          </span>
                        )}
                        {r.card > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300">
                            <CreditCard className="w-3 h-3" />K {fmtMoney(r.card)}
                          </span>
                        )}
                        {r.wallet > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300">
                            <Wallet className="w-3 h-3" />C {fmtMoney(r.wallet)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold", meta.cls)}>
                        {MIcon && <MIcon className="w-3 h-3" />}
                        {meta.label}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, className, icon: Icon }: { children: React.ReactNode; className?: string; icon?: typeof Baby }) {
  return (
    <th className={cn("px-3 py-2.5 font-bold whitespace-nowrap", className)}>
      <span className="inline-flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3 opacity-60" />}
        {children}
      </span>
    </th>
  )
}
