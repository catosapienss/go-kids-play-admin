"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Archive, CheckCircle2, AlertTriangle, HelpCircle, ChevronRight, RefreshCw,
  StickyNote, Store, User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  listRecentClosings, listStaffClosings, staffClosingNo, type StaffClosingRow,
} from "@/lib/services/cash-register.service"
import { type CashRegister, isReconciled, totalDiscrepancy } from "@/types/cash-register"
import { EmptyState } from "@/components/system/empty-state"
import { ClosingBreakdown } from "./day-end-closing-card"
import { useReconnectToken } from "@/lib/reliability/realtime-supervisor"
import { SearchBox, FilterChips, Pager } from "./closing-table-parts"

// ─── Kapanış Geçmişi — unified closing history ───────────────────────────────
//
// ONE ledger for both closing kinds, newest first:
//
//   • "Kasa"     — cash_register_closings (manager/admin day-end reconciliation)
//   • "Personel" — staff.day.closing audit records (personnel handovers)
//
// They share a single table, a single set of filters and a single pager; the
// `Tür` column and its filter chip tell the two apart, and each row expands to
// the detail appropriate for its kind.
//
// Staff rows only carry system-side figures (revenue / wallet / retail /
// transaction count / difference) when the submit-time snapshot exists — older
// handovers predate it and show "—" rather than a fabricated number.

const PAGE_SIZE = 12
const TOLERANCE = 0.005

function fmtTRY(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function money(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `₺${fmtTRY(n)}`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })
  } catch { return iso }
}

function fmtWeekday(iso: string): string {
  try { return new Date(iso).toLocaleDateString("tr-TR", { weekday: "short" }) } catch { return "" }
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  } catch { return "—" }
}

function closingNo(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}

// ─── Unified row shape ───────────────────────────────────────────────────────

type Kind = "register" | "staff"
type Tone = "ok" | "diff" | "unknown"

interface Row {
  id: string
  kind: Kind
  closingNo: string
  businessDate: string
  /** Closed-at (kasa) or submitted-at (personel). */
  at: string | null
  personName: string
  revenue: number | null
  cash: number | null
  card: number | null
  wallet: number | null
  retail: number | null
  difference: number | null
  transactionCount: number | null
  notes: string | null
  /** Kind-specific payload for the expanded detail. */
  register?: CashRegister
  staff?: StaffClosingRow
}

function breakdownOf(r: CashRegister): Record<string, number> | null {
  const b = (r.meta as { breakdown?: Record<string, number> | null } | null)?.breakdown
  return b ?? null
}

function registerToRow(r: CashRegister): Row {
  const b = breakdownOf(r)
  return {
    id: `reg:${r.id}`,
    kind: "register",
    closingNo: closingNo(r.id),
    businessDate: r.businessDate,
    at: r.closedAt,
    personName: r.closedByName ?? "—",
    revenue: b?.total_revenue ?? r.expectedTotal,
    cash: r.countedCash,
    card: r.countedCard,
    wallet: r.countedWallet,
    retail: b?.retail_revenue ?? null,
    difference: totalDiscrepancy(r),
    transactionCount: r.transactionCount,
    notes: r.notes || null,
    register: r,
  }
}

function staffToRow(s: StaffClosingRow): Row {
  return {
    id: `stf:${s.id}`,
    kind: "staff",
    closingNo: s.closingNo || staffClosingNo(s.id),
    businessDate: s.businessDate,
    at: s.submittedAt,
    personName: s.submittedByName,
    revenue: s.totalRevenue ?? s.expectedTotal,
    cash: s.cash,
    card: s.posZ,
    wallet: s.walletTotal ?? s.expectedWallet,
    retail: s.retailRevenue,
    difference: s.difference,
    transactionCount: s.transactionCount,
    notes: s.notes,
    staff: s,
  }
}

function toneOf(r: Row): Tone {
  if (r.difference === null) return "unknown"
  return Math.abs(r.difference) < TOLERANCE ? "ok" : "diff"
}

function sortKey(r: Row): number {
  const t = new Date(r.at ?? r.businessDate).getTime()
  return Number.isFinite(t) ? t : 0
}

type KindFilter = "all" | Kind
type StatusFilter = "all" | "ok" | "diff"
type RangeFilter = "all" | "7" | "30" | "90"

export function ClosingHistory() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<KindFilter>("all")
  const [person, setPerson] = useState("all")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [range, setRange] = useState<RangeFilter>("all")
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const reconnectToken = useReconnectToken()

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)

    // Staff handovers are best-effort (the service already swallows its own
    // errors) — a register-history failure is the only real error state.
    void Promise.all([listRecentClosings(200), listStaffClosings(200)])
      .then(([regs, staff]) => {
        if (cancelled) return
        const merged = [...regs.map(registerToRow), ...staff.map(staffToRow)]
        merged.sort((a, b) => sortKey(b) - sortKey(a))
        setRows(merged)
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Veri çekilemedi") })

    return () => { cancelled = true }
  }, [reconnectToken, reloadKey])

  const people = useMemo(() => {
    const set = new Set((rows ?? []).map((r) => r.personName).filter((n) => n && n !== "—"))
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr-TR"))
  }, [rows])

  const counts = useMemo(() => ({
    register: (rows ?? []).filter((r) => r.kind === "register").length,
    staff:    (rows ?? []).filter((r) => r.kind === "staff").length,
  }), [rows])

  const filtered = useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLocaleLowerCase("tr-TR")
    const cutoff = range === "all" ? null : Date.now() - Number(range) * 86_400_000

    return rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false
      if (person !== "all" && r.personName !== person) return false

      const t = toneOf(r)
      if (status === "ok" && t !== "ok") return false
      if (status === "diff" && t !== "diff") return false

      if (cutoff !== null) {
        const ts = new Date(r.businessDate).getTime()
        if (Number.isFinite(ts) && ts < cutoff) return false
      }

      if (!q) return true
      const haystack = [
        r.closingNo, r.personName, r.businessDate, fmtDate(r.businessDate), r.notes ?? "",
        r.kind === "register" ? "kasa" : "personel",
        String((r.register?.meta as { z_report_no?: string | null } | null)?.z_report_no ?? ""),
      ].join(" ").toLocaleLowerCase("tr-TR")
      return haystack.includes(q)
    })
  }, [rows, query, kind, person, status, range])

  // Keep the page in range whenever the filters shrink the result set.
  useEffect(() => { setPage(1) }, [query, kind, person, status, range])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (rows === null && !error) {
    return (
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-6 animate-pulse">
        <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-9 bg-slate-100 dark:bg-slate-800 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center flex-shrink-0">
          <Archive className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Kapanış Geçmişi</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Kasa kapanışları ve personel teslimleri · tek defter
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
            {filtered.length} kayıt
          </span>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Yenile"
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex flex-wrap items-center gap-2">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Kapanış no, tarih, kişi veya not ara…"
          accent="focus:ring-slate-400/40"
        />
        <FilterChips<KindFilter>
          value={kind}
          onChange={setKind}
          activeClass="bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
          options={[
            { value: "all",      label: "Tümü" },
            { value: "register", label: `Kasa (${counts.register})` },
            { value: "staff",    label: `Personel (${counts.staff})` },
          ]}
        />
        <select
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          aria-label="Kişi filtresi"
          className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[12px] font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-slate-400/40"
        >
          <option value="all">Tüm kişiler</option>
          {people.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <FilterChips<RangeFilter>
          value={range}
          onChange={setRange}
          activeClass="bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
          options={[
            { value: "all", label: "Tümü" },
            { value: "7",  label: "7 gün" },
            { value: "30", label: "30 gün" },
            { value: "90", label: "90 gün" },
          ]}
        />
        <FilterChips<StatusFilter>
          value={status}
          onChange={setStatus}
          activeClass="bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
          options={[
            { value: "all",  label: "Tüm durumlar" },
            { value: "ok",   label: "Tutuyor" },
            { value: "diff", label: "Farklı" },
          ]}
        />
      </div>

      {error ? (
        <EmptyState title="Geçmiş okunamadı" body={error} tone="danger" onRetry={() => setReloadKey((k) => k + 1)} />
      ) : rows && rows.length === 0 ? (
        <EmptyState title="Henüz kapanış yok" body="İlk kasa kapatıldığında veya personel teslim ettiğinde burada görünecek." />
      ) : filtered.length === 0 ? (
        <EmptyState title="Eşleşen kapanış yok" body="Arama veya filtreleri değiştirmeyi deneyin." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left  font-bold px-4 py-2">Kapanış No</th>
                  <th className="text-left  font-bold px-3 py-2">Tür</th>
                  <th className="text-left  font-bold px-3 py-2">Tarih</th>
                  <th className="text-left  font-bold px-3 py-2">Saat</th>
                  <th className="text-left  font-bold px-3 py-2">Kapatan</th>
                  <th className="text-right font-bold px-3 py-2">Toplam Ciro</th>
                  <th className="text-right font-bold px-3 py-2">Nakit</th>
                  <th className="text-right font-bold px-3 py-2">Kart</th>
                  <th className="text-right font-bold px-3 py-2">Cüzdan</th>
                  <th className="text-right font-bold px-3 py-2">Perakende</th>
                  <th className="text-right font-bold px-3 py-2">Fark</th>
                  <th className="text-right font-bold px-3 py-2">İşlem</th>
                  <th className="text-left  font-bold px-3 py-2">Durum</th>
                  <th className="text-center font-bold px-3 py-2">Not</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {pageRows.map((r) => (
                  <ClosingRow
                    key={r.id}
                    r={r}
                    isExpanded={expanded === r.id}
                    onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <Pager
            page={safePage}
            pageCount={pageCount}
            total={filtered.length}
            from={(safePage - 1) * PAGE_SIZE + 1}
            to={Math.min(safePage * PAGE_SIZE, filtered.length)}
            onPage={setPage}
          />
        </>
      )}
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function ClosingRow({ r, isExpanded, onToggle }: {
  r: Row; isExpanded: boolean; onToggle: () => void
}) {
  const tone = toneOf(r)
  const diff = r.difference

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-colors",
          isExpanded ? "bg-slate-50 dark:bg-slate-800/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/30",
        )}
      >
        <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {r.closingNo}
        </td>
        <td className="px-3 py-2.5"><KindPill kind={r.kind} /></td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className="font-bold text-slate-900 dark:text-white">{fmtDate(r.businessDate)}</span>
          <span className="ml-1.5 text-[10px] text-slate-400">{fmtWeekday(r.businessDate)}</span>
        </td>
        <td className="px-3 py-2.5 tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtTime(r.at)}</td>
        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200 max-w-[170px] truncate">{r.personName}</td>
        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">{money(r.revenue)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{money(r.cash)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-sky-600 dark:text-sky-400 whitespace-nowrap">{money(r.card)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-violet-600 dark:text-violet-400 whitespace-nowrap">{money(r.wallet)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">{money(r.retail)}</td>
        <td className={cn(
          "px-3 py-2.5 text-right tabular-nums font-bold whitespace-nowrap",
          tone !== "diff" ? "text-slate-400"
            : (diff ?? 0) < 0 ? "text-rose-600 dark:text-rose-400"
            : "text-amber-600 dark:text-amber-400",
        )}>
          {diff === null ? "—" : tone === "ok" ? "₺0" : (diff > 0 ? "+" : "") + "₺" + fmtTRY(diff)}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
          {r.transactionCount ?? "—"}
        </td>
        <td className="px-3 py-2.5"><StatusPill tone={tone} /></td>
        <td className="px-3 py-2.5 text-center">
          {r.notes ? (
            <span title={r.notes} className="inline-flex text-amber-500"><StickyNote className="w-3.5 h-3.5" /></span>
          ) : (
            <span className="text-slate-300 dark:text-slate-700">—</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <ChevronRight className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", isExpanded && "rotate-90")} />
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-slate-50 dark:bg-slate-950/30">
          <td colSpan={15} className="px-5 py-4">
            {r.register ? <RegisterDetail r={r.register} /> : r.staff ? <StaffDetail s={r.staff} /> : null}
          </td>
        </tr>
      )}
    </>
  )
}

function KindPill({ kind }: { kind: Kind }) {
  const cfg = kind === "register"
    ? { cls: "bg-slate-900/5 dark:bg-white/10 text-slate-700 dark:text-slate-200", Icon: Store, label: "Kasa" }
    : { cls: "bg-violet-500/10 text-violet-700 dark:text-violet-300", Icon: User, label: "Personel" }
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap", cfg.cls)}>
      <cfg.Icon className="w-3 h-3" />{cfg.label}
    </span>
  )
}

function StatusPill({ tone }: { tone: Tone }) {
  const cfg = tone === "ok"
    ? { cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", Icon: CheckCircle2, label: "Tutuyor" }
    : tone === "diff"
      ? { cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400", Icon: AlertTriangle, label: "Fark" }
      : { cls: "bg-slate-500/10 text-slate-500 dark:text-slate-400", Icon: HelpCircle, label: "Teslim edildi" }
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap", cfg.cls)}>
      <cfg.Icon className="w-3 h-3" />{cfg.label}
    </span>
  )
}

// ─── Expanded detail — kasa ──────────────────────────────────────────────────

function RegisterDetail({ r }: { r: CashRegister }) {
  const leftInDrawer = Number((r.meta as { left_in_drawer?: number } | null)?.left_in_drawer ?? 0)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <DiffPair label="Nakit"  expected={r.expectedCash}   counted={r.countedCash}   diff={r.diffCash}   />
        <DiffPair label="Kart"   expected={r.expectedCard}   counted={r.countedCard}   diff={r.diffCard}   />
        <DiffPair label="Cüzdan" expected={r.expectedWallet} counted={r.countedWallet} diff={r.diffWallet} />
      </div>
      <div className="-mx-5"><ClosingBreakdown meta={r.meta} compact /></div>
      {leftInDrawer > 0 && (
        <div className="rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.05] px-3 py-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300">
            Kasada Bırakılan
          </span>
          <span className="text-sm font-bold tabular-nums text-amber-800 dark:text-amber-200">
            ₺{leftInDrawer.toLocaleString("tr-TR")}
          </span>
        </div>
      )}
      {r.notes && <NotesBlock notes={r.notes} />}
    </div>
  )
}

function DiffPair({ label, expected, counted, diff }: {
  label: string; expected: number; counted: number; diff: number
}) {
  const ok = isReconciled(diff)
  return (
    <div className="rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-2">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-[12px] font-bold tabular-nums text-slate-900 dark:text-white">₺{fmtTRY(counted)}</p>
      <p className="text-[10px] text-slate-400 tabular-nums">Bekl: ₺{fmtTRY(expected)}</p>
      <p className={cn(
        "text-[10px] font-bold tabular-nums mt-0.5",
        ok ? "text-emerald-600 dark:text-emerald-400"
          : diff < 0 ? "text-rose-600 dark:text-rose-400"
          : "text-amber-600 dark:text-amber-400",
      )}>
        {ok ? "✓" : (diff > 0 ? "+" : "") + "₺" + fmtTRY(diff)}
      </p>
    </div>
  )
}

// ─── Expanded detail — personel ──────────────────────────────────────────────

function StaffDetail({ s }: { s: StaffClosingRow }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1.5">Teslim Edilen</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Cell label="Nakit Kasa"    value={money(s.cash)} tone="emerald" />
          <Cell label="POS Z-Raporu"  value={money(s.posZ)} tone="sky" />
          <Cell label="Toplam Teslim" value={money(s.countedTotal)} />
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1.5">Sistem (Beklenen)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Cell label="Beklenen Nakit"  value={money(s.expectedCash)} />
          <Cell label="Beklenen Kart"   value={money(s.expectedCard)} />
          <Cell label="Cüzdan"          value={money(s.walletTotal ?? s.expectedWallet)} />
          <Cell label="Toplam Ciro"     value={money(s.totalRevenue ?? s.expectedTotal)} />
          <Cell label="Perakende Satış" value={money(s.retailRevenue)} />
          <Cell label="İşlem Sayısı"    value={s.transactionCount === null ? "—" : String(s.transactionCount)} />
        </div>
        {s.expectedCash === null && (
          <p className="text-[11px] text-slate-400 mt-1.5">
            Bu teslim, sistem anlık görüntüsü eklenmeden önce kaydedilmiş — beklenen tutarlar mevcut değil.
          </p>
        )}
      </div>

      {s.notes && <NotesBlock notes={s.notes} />}
    </div>
  )
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "sky" }) {
  return (
    <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-2">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn(
        "text-[12px] font-bold tabular-nums",
        tone === "emerald" ? "text-emerald-600 dark:text-emerald-400"
          : tone === "sky" ? "text-sky-600 dark:text-sky-400"
          : "text-slate-900 dark:text-white",
      )}>
        {value}
      </p>
    </div>
  )
}

function NotesBlock({ notes }: { notes: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">Notlar</p>
      <p className="text-[12px] text-slate-700 dark:text-slate-300 whitespace-pre-line p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
        {notes}
      </p>
    </div>
  )
}
