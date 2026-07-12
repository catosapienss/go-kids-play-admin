"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Boxes, Plus, Loader2, ClipboardCheck, Search, RotateCcw, Check, AlertTriangle,
  FileText, ArrowLeftRight, Trash2, TrendingDown, TrendingUp, Save,
} from "lucide-react"
import { cn, formatNumberTR, formatTRY } from "@/lib/utils"
import {
  listStockProducts, adjustStock, setMinStock,
  getOpenStockCount, startStockCount, getStockCountItems, setCountItemQty, applyStockCount,
  recordStockInvoice, listStockInvoices, listStockMovements, getSoldCounts,
  type StockProduct, type StockCount, type StockCountItem,
  type StockInvoiceRow, type StockMovementRow, type InvoiceLineInput,
} from "@/lib/services/inventory.service"

// ─── Perakende · Stok (inventory) — manager only ─────────────────────────────
//
// Two views: live stock list (with restock) and a monthly physical count.
// Sales & waste auto-decrement stock in the DB; here managers restock and
// reconcile via a count.

const DEFAULT_LOW_STOCK = 5

type View = "list" | "invoice" | "movements" | "count"

export function StockPanel() {
  const [view, setView] = useState<View>("list")
  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60">
        <SubTab active={view === "list"}      onClick={() => setView("list")}      icon={<Boxes className="w-3.5 h-3.5" />}          label="Stok Listesi" />
        <SubTab active={view === "invoice"}   onClick={() => setView("invoice")}   icon={<FileText className="w-3.5 h-3.5" />}       label="Fatura Girişi" />
        <SubTab active={view === "movements"} onClick={() => setView("movements")} icon={<ArrowLeftRight className="w-3.5 h-3.5" />} label="Hareketler" />
        <SubTab active={view === "count"}     onClick={() => setView("count")}     icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Aylık Sayım" />
      </div>
      {view === "list"      && <StockList />}
      {view === "invoice"   && <InvoiceEntry />}
      {view === "movements" && <MovementsPanel />}
      {view === "count"     && <MonthlyCount />}
    </div>
  )
}

// ─── Live stock list + restock ───────────────────────────────────────────────

function isLow(p: StockProduct): boolean {
  const threshold = p.minStock > 0 ? p.minStock : DEFAULT_LOW_STOCK
  return p.stockOnHand <= threshold
}

function StockList() {
  const [rows, setRows] = useState<StockProduct[] | null>(null)
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sold, setSold] = useState<{ today: number; month: number }>({ today: 0, month: 0 })

  const refresh = useCallback(async () => {
    const [list, s] = await Promise.all([listStockProducts(), getSoldCounts()])
    setRows(list); setSold(s)
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const filtered = useMemo(() => {
    const list = rows ?? []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((p) => p.name.toLowerCase().includes(q))
  }, [rows, search])

  async function restock(p: StockProduct) {
    const raw = window.prompt(`"${p.name}" için kaç adet stok eklensin? (manuel giriş — fatura için "Fatura Girişi" sekmesini kullan)`, "10")
    if (raw == null) return
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n === 0) { toast.error("Geçerli bir adet gir"); return }
    setBusyId(p.id)
    try {
      await adjustStock(p.id, n, "restock", "Manuel stok girişi")
      toast.success(`${p.name} · ${n > 0 ? "+" : ""}${n} stok`)
      await refresh()
    } catch (e) {
      toast.error("Stok güncellenemedi: " + (e instanceof Error ? e.message : ""))
    } finally { setBusyId(null) }
  }

  async function editMin(p: StockProduct) {
    const raw = window.prompt(`"${p.name}" için minimum stok (düşük stok uyarısı):`, String(p.minStock || DEFAULT_LOW_STOCK))
    if (raw == null) return
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 0) { toast.error("Geçerli bir sayı gir"); return }
    setBusyId(p.id)
    try { await setMinStock(p.id, n); toast.success("Minimum stok güncellendi"); await refresh() }
    catch (e) { toast.error("Güncellenemedi: " + (e instanceof Error ? e.message : "")) }
    finally { setBusyId(null) }
  }

  const lowCount = (rows ?? []).filter(isLow).length

  return (
    <div className="space-y-3">
      {/* Report summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniStat label="Ürün Çeşidi"     value={rows ? String(rows.length) : "…"}            icon={<Boxes className="w-4 h-4" />}        tone="slate" />
        <MiniStat label="Bugün Satılan"   value={`${formatNumberTR(sold.today)} adet`}          icon={<TrendingDown className="w-4 h-4" />} tone="sky" />
        <MiniStat label="Bu Ay Satılan"   value={`${formatNumberTR(sold.month)} adet`}          icon={<TrendingDown className="w-4 h-4" />} tone="violet" />
        <MiniStat label="Düşük Stok"      value={rows ? `${lowCount} ürün` : "…"}               icon={<AlertTriangle className="w-4 h-4" />} tone={lowCount > 0 ? "amber" : "emerald"} />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün ara…"
              className="flex-1 text-sm bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500" />
          </div>
        </div>

        {rows === null ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2 font-bold">Ürün</th>
                  <th className="px-4 py-2 font-bold text-right">Stok</th>
                  <th className="px-4 py-2 font-bold text-right">Min</th>
                  <th className="px-4 py-2 font-bold text-right pr-4">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = isLow(p)
                  return (
                    <tr key={p.id} className={cn("border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40", low && "bg-amber-50/40 dark:bg-amber-500/[0.04]")}>
                      <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                        {p.name}
                        {low && <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400"><AlertTriangle className="w-3 h-3" />düşük</span>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={cn(
                          "inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-lg text-sm font-bold",
                          p.stockOnHand < 0 ? "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300"
                          : low ? "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                        )}>{formatNumberTR(p.stockOnHand)}</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => editMin(p)} disabled={busyId === p.id}
                          className="text-xs text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 font-semibold tabular-nums">
                          {p.minStock > 0 ? formatNumberTR(p.minStock) : "—"}
                        </button>
                      </td>
                      <td className="px-4 py-2 pr-4 text-right">
                        <button onClick={() => restock(p)} disabled={busyId === p.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold">
                          {busyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Stok Ekle
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-sm text-slate-400">Ürün yok</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value, icon, tone }: {
  label: string; value: string; icon: React.ReactNode
  tone: "slate" | "sky" | "violet" | "amber" | "emerald"
}) {
  const tones: Record<typeof tone, string> = {
    slate:   "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
    sky:     "bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300",
    violet:  "bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300",
    amber:   "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300",
    emerald: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  }
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center gap-2.5">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-base font-black text-slate-900 dark:text-white leading-tight tabular-nums truncate">{value}</p>
      </div>
    </div>
  )
}

// ─── Invoice entry (supplier purchase → stock in) ────────────────────────────

function InvoiceEntry() {
  const [products, setProducts] = useState<StockProduct[]>([])
  const [supplier, setSupplier] = useState("")
  const [invoiceNo, setInvoiceNo] = useState("")
  const [note, setNote] = useState("")
  const [lines, setLines] = useState<InvoiceLineInput[]>([])
  const [pick, setPick] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => { void listStockProducts().then(setProducts) }, [])

  function addLine(p: StockProduct) {
    setLines((prev) => prev.some((l) => l.productId === p.id) ? prev
      : [...prev, { productId: p.id, productName: p.name, quantity: 1, unitCost: p.salePrice }])
    setPick("")
  }
  function updateLine(id: string, patch: Partial<InvoiceLineInput>) {
    setLines((prev) => prev.map((l) => l.productId === id ? { ...l, ...patch } : l))
  }
  function removeLine(id: string) { setLines((prev) => prev.filter((l) => l.productId !== id)) }

  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0)
  const units = lines.reduce((s, l) => s + l.quantity, 0)
  const options = products.filter((p) => !lines.some((l) => l.productId === p.id))

  async function submit() {
    if (lines.length === 0) { toast.error("En az bir ürün ekle"); return }
    if (lines.some((l) => l.quantity <= 0)) { toast.error("Adetler 0'dan büyük olmalı"); return }
    setBusy(true)
    try {
      await recordStockInvoice({ supplier, invoiceNo, note, items: lines })
      toast.success(`Fatura kaydedildi · ${units} adet stok eklendi`)
      setSupplier(""); setInvoiceNo(""); setNote(""); setLines([])
    } catch (e) {
      toast.error("Fatura kaydedilemedi: " + (e instanceof Error ? e.message : ""))
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-violet-500" /> Tedarikçi Fatura Girişi</p>
        <p className="text-[11px] text-slate-500 mt-0.5">Faturayı gir → ürün ve adetleri ekle → stok otomatik artar.</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Tedarikçi (opsiyonel)"
            className="text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500" />
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Fatura No (opsiyonel)"
            className="text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500" />
        </div>

        {/* Product picker */}
        <div className="flex items-center gap-2">
          <select value={pick} onChange={(e) => { const p = products.find((x) => x.id === e.target.value); if (p) addLine(p) }}
            className="flex-1 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500">
            <option value="">+ Ürün ekle…</option>
            {options.map((p) => <option key={p.id} value={p.id}>{p.name} (stok: {p.stockOnHand})</option>)}
          </select>
        </div>

        {/* Lines */}
        {lines.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {lines.map((l) => (
              <div key={l.productId} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{l.productName}</span>
                <label className="text-[10px] text-slate-400">Adet</label>
                <input type="number" min={1} value={l.quantity} onChange={(e) => updateLine(l.productId, { quantity: parseInt(e.target.value, 10) || 0 })}
                  className="w-16 text-right text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 tabular-nums" />
                <label className="text-[10px] text-slate-400">Birim ₺</label>
                <input type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => updateLine(l.productId, { unitCost: parseFloat(e.target.value) || 0 })}
                  className="w-20 text-right text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 tabular-nums" />
                <span className="w-20 text-right text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{formatTRY(l.quantity * l.unitCost)}</span>
                <button onClick={() => removeLine(l.productId)} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Not (opsiyonel)"
          className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-violet-500" />

        <div className="flex items-center justify-between pt-1">
          <div className="text-sm">
            <span className="text-slate-500">Toplam: </span>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">{formatTRY(total)}</span>
            <span className="text-slate-400"> · {units} adet</span>
          </div>
          <button onClick={submit} disabled={busy || lines.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Faturayı Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Movements + invoice history ─────────────────────────────────────────────

const MOVEMENT_LABELS: Record<string, string> = {
  sale: "Satış", waste: "Zayiat", restock: "Stok Girişi", count_adjust: "Sayım Düzeltme",
  manual: "Manuel", initial: "Başlangıç", adjust: "Düzeltme", damage: "Hasar",
}

function MovementsPanel() {
  const [moves, setMoves] = useState<StockMovementRow[] | null>(null)
  const [invoices, setInvoices] = useState<StockInvoiceRow[] | null>(null)

  useEffect(() => {
    void listStockMovements(150).then(setMoves)
    void listStockInvoices(50).then(setInvoices)
  }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Movements ledger */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><ArrowLeftRight className="w-4 h-4 text-slate-400" /> Stok Hareketleri</p>
        </div>
        {moves === null ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        : moves.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Hareket yok</p>
        : (
          <div className="max-h-[62vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {moves.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                  m.delta >= 0 ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300")}>
                  {m.delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{m.productName}</p>
                  <p className="text-[11px] text-slate-500 truncate">{MOVEMENT_LABELS[m.movementType] ?? m.movementType}{m.reason ? ` · ${m.reason}` : ""}</p>
                </div>
                <span className={cn("text-sm font-bold tabular-nums", m.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {m.delta > 0 ? "+" : ""}{formatNumberTR(m.delta)}
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums w-20 text-right">{new Date(m.createdAt).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoice history */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> Fatura Geçmişi</p>
        </div>
        {invoices === null ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        : invoices.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Fatura yok</p>
        : (
          <div className="max-h-[62vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {invoices.map((inv) => (
              <div key={inv.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {inv.supplierName || "Tedarikçi —"}{inv.invoiceNo ? ` · #${inv.invoiceNo}` : ""}
                  </p>
                  <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatTRY(inv.totalCost)}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {inv.itemCount} adet · {inv.createdByName ?? "—"} · {new Date(inv.createdAt).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Monthly physical count ──────────────────────────────────────────────────

function MonthlyCount() {
  const [count, setCount] = useState<StockCount | null | undefined>(undefined) // undefined = loading
  const [items, setItems] = useState<StockCountItem[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const open = await getOpenStockCount()
    setCount(open)
    if (open) setItems(await getStockCountItems(open.id))
    else setItems(null)
  }, [])
  useEffect(() => { void load() }, [load])

  async function start() {
    setBusy(true)
    try { await startStockCount(); await load(); toast.success("Sayım başlatıldı") }
    catch (e) { toast.error("Sayım başlatılamadı: " + (e instanceof Error ? e.message : "")) }
    finally { setBusy(false) }
  }

  async function saveQty(item: StockCountItem, val: string) {
    const n = val === "" ? null : parseInt(val, 10)
    if (val !== "" && !Number.isFinite(n as number)) return
    setItems((prev) => prev?.map((it) => it.id === item.id ? { ...it, countedQty: n } : it) ?? null)
    try { await setCountItemQty(item.id, n) } catch { /* best-effort; UI already updated */ }
  }

  async function apply() {
    if (!count) return
    const counted = (items ?? []).filter((i) => i.countedQty != null).length
    if (counted === 0) { toast.error("Önce sayım adetlerini gir"); return }
    if (!window.confirm(`${counted} ürün için sayım uygulanacak ve stoklar güncellenecek. Onaylıyor musun?`)) return
    setBusy(true)
    try { await applyStockCount(count.id); toast.success("Sayım uygulandı, stoklar güncellendi"); await load() }
    catch (e) { toast.error("Sayım uygulanamadı: " + (e instanceof Error ? e.message : "")) }
    finally { setBusy(false) }
  }

  if (count === undefined) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>

  if (!count) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-3">
          <ClipboardCheck className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aylık Stok Sayımı</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4 max-w-sm mx-auto">
          Sayımı başlat, her ürünün fiziksel adedini gir, uygula — stoklar sayılan değere güncellenir ve fark kaydedilir.
        </p>
        <button onClick={start} disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />} Sayımı Başlat
        </button>
      </div>
    )
  }

  const countedN = (items ?? []).filter((i) => i.countedQty != null).length

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Aktif Sayım <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">açık</span>
          </p>
          <p className="text-[11px] text-slate-500">{count.startedByName ?? "—"} · {countedN}/{items?.length ?? 0} ürün sayıldı</p>
        </div>
        <button onClick={apply} disabled={busy || countedN === 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Sayımı Uygula
        </button>
      </div>

      <div className="overflow-x-auto max-h-[62vh] overflow-y-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 sticky top-0">
            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2 font-bold">Ürün</th>
              <th className="px-4 py-2 font-bold text-right">Sistemdeki</th>
              <th className="px-4 py-2 font-bold text-right">Sayılan</th>
              <th className="px-4 py-2 font-bold text-right pr-4">Fark</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it) => {
              const diff = it.countedQty == null ? null : it.countedQty - it.systemQty
              return (
                <tr key={it.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                  <td className="px-4 py-1.5 font-medium text-slate-800 dark:text-slate-100">{it.productName}</td>
                  <td className="px-4 py-1.5 text-right text-slate-500">{formatNumberTR(it.systemQty)}</td>
                  <td className="px-4 py-1.5 text-right">
                    <input type="number" defaultValue={it.countedQty ?? ""} onBlur={(e) => saveQty(it, e.target.value)}
                      placeholder="—"
                      className="w-20 text-right px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold focus:outline-none focus:border-violet-500" />
                  </td>
                  <td className={cn("px-4 py-1.5 pr-4 text-right font-bold",
                    diff == null ? "text-slate-300 dark:text-slate-600" : diff === 0 ? "text-slate-400" : diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {diff == null ? "—" : `${diff > 0 ? "+" : ""}${formatNumberTR(diff)}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
        <RotateCcw className="w-3 h-3" /> Uygula'ya basınca stoklar sayılan değere güncellenir, fark hareketi kaydedilir.
      </div>
    </div>
  )
}

function SubTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors",
        active ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}>
      {icon}{label}
    </button>
  )
}
