"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Search, Calendar, Loader2, Baby, User, Phone, Clock, Package,
  Banknote, CreditCard, Wallet, Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

// ─── CRM Transactions Panel ─────────────────────────────────────────────────
//
// Modernised replacement for the Excel-style ledger the operator was tracking
// manually. Pulls one row per session in the selected date range with joined
// payment totals + method breakdown. Read-only; no writes.
//
// Columns:
//   Çocuk · Veli · Telefon · Paket · Tarih · Giriş · Çıkış · Süre · Ücret · Ödeme

interface SessionRow {
  id:           string
  child_name:   string | null
  parent_name:  string | null
  parent_phone: string | null
  duration_minutes: number
  start_time:   string
  end_time:     string | null
  ended_at:     string | null
}

interface PaymentTotals {
  total:  number
  method: "cash" | "card" | "wallet" | "mixed" | "free"
}

interface Row extends SessionRow {
  paymentTotal:  number
  paymentMethod: PaymentTotals["method"]
}

const METHOD_META: Record<PaymentTotals["method"], { label: string; cls: string; icon?: typeof Banknote }> = {
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

function pickMethod(cash: number, card: number, wallet: number): PaymentTotals["method"] {
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
        // include "to" date fully (up to 23:59:59.999)
        const toIso   = new Date(to   + "T23:59:59.999").toISOString()

        let q = supabase
          .from("sessions")
          .select("id, child_name, parent_name, parent_phone, duration_minutes, start_time, end_time, ended_at")
          .gte("start_time", fromIso)
          .lte("start_time", toIso)
          .order("start_time", { ascending: false })
          .limit(400)

        if (phone.trim()) {
          const digits = phone.replace(/\D/g, "")
          if (digits.length >= 3) q = q.ilike("parent_phone", `%${digits}%`)
        }

        const { data: sessions, error: sErr } = await q
        if (sErr) throw sErr
        const sList = (sessions ?? []) as SessionRow[]
        if (sList.length === 0) { if (!cancelled) setRows([]); return }

        const ids = sList.map((s) => s.id)
        const { data: pays } = await supabase
          .from("payments")
          .select("session_id, cash_amount, card_amount, wallet_amount, total_amount")
          .in("session_id", ids)

        const payMap = new Map<string, PaymentTotals>()
        for (const p of (pays ?? []) as Array<{
          session_id: string; cash_amount: number | string | null; card_amount: number | string | null;
          wallet_amount: number | string | null; total_amount: number | string | null
        }>) {
          const cash   = Number(p.cash_amount   ?? 0) || 0
          const card   = Number(p.card_amount   ?? 0) || 0
          const wallet = Number(p.wallet_amount ?? 0) || 0
          const total  = Number(p.total_amount  ?? cash + card + wallet) || 0
          const prev   = payMap.get(p.session_id)
          if (prev) {
            payMap.set(p.session_id, {
              total:  prev.total + total,
              method: prev.method === "mixed" ? "mixed" : (pickMethod(cash, card, wallet) === prev.method ? prev.method : "mixed"),
            })
          } else {
            payMap.set(p.session_id, { total, method: pickMethod(cash, card, wallet) })
          }
        }

        if (cancelled) return
        setRows(
          sList.map((s): Row => {
            const t = payMap.get(s.id)
            return {
              ...s,
              paymentTotal:  t?.total ?? 0,
              paymentMethod: t?.method ?? "free",
            }
          }),
        )
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi")
      }
    }

    void load()
    return () => { cancelled = true }
  }, [from, to, phone])

  const grandTotal = useMemo(
    () => (rows ?? []).reduce((s, r) => s + r.paymentTotal, 0),
    [rows],
  )

  function exportCsv() {
    if (!rows || rows.length === 0) return
    const header = ["Çocuk","Veli","Telefon","Paket","Tarih","Giriş","Çıkış","Süre (dk)","Ücret","Ödeme"]
    const lines = rows.map((r) => [
      r.child_name ?? "",
      r.parent_name ?? "",
      r.parent_phone ?? "",
      r.duration_minutes === 0 ? "Sınırsız" : `${r.duration_minutes} dk`,
      fmtDate(r.start_time),
      fmtHM(r.start_time),
      fmtHM(r.ended_at ?? r.end_time),
      String(r.duration_minutes ?? 0),
      String(r.paymentTotal),
      METHOD_META[r.paymentMethod].label,
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
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 tabular-nums focus:outline-none focus:border-violet-500"
          />
          <span className="text-slate-400 text-xs">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 tabular-nums focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefon ile ara…"
            className="flex-1 text-xs font-semibold bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 tabular-nums focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Toplam</p>
          <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
            {rows ? `${rows.length} · ${fmtMoney(grandTotal)}` : "…"}
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          disabled={!rows || rows.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          <Download className="w-3 h-3" />
          CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 sticky top-0">
            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Th icon={Baby}>Çocuk</Th>
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
              <tr><td colSpan={10} className="py-12 text-center text-slate-400 text-sm">
                Bu aralıkta hareket yok
              </td></tr>
            ) : rows && rows.map((r) => {
              const meta = METHOD_META[r.paymentMethod]
              const MIcon = meta.icon
              return (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
                    {r.child_name || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                    {r.parent_name || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-[12.5px] whitespace-nowrap">
                    {r.parent_phone || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {r.duration_minutes === 0 ? "Sınırsız" : `${r.duration_minutes} dk`}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {fmtDate(r.start_time)}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    {fmtHM(r.start_time)}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    {fmtHM(r.ended_at ?? r.end_time)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300 font-semibold">
                    {r.duration_minutes === 0 ? "∞" : `${r.duration_minutes} dk`}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                    {r.paymentTotal > 0 ? fmtMoney(r.paymentTotal) : "—"}
                  </td>
                  <td className="px-3 py-2 pr-4 text-right">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold",
                      meta.cls,
                    )}>
                      {MIcon && <MIcon className="w-3 h-3" />}
                      {meta.label}
                    </span>
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
