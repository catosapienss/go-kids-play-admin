"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Boxes, Plus, Loader2, ClipboardCheck, Search, RotateCcw, Check, AlertTriangle,
} from "lucide-react"
import { cn, formatNumberTR } from "@/lib/utils"
import {
  listStockProducts, adjustStock,
  getOpenStockCount, startStockCount, getStockCountItems, setCountItemQty, applyStockCount,
  type StockProduct, type StockCount, type StockCountItem,
} from "@/lib/services/inventory.service"

// ─── Perakende · Stok (inventory) — manager only ─────────────────────────────
//
// Two views: live stock list (with restock) and a monthly physical count.
// Sales & waste auto-decrement stock in the DB; here managers restock and
// reconcile via a count.

const LOW_STOCK = 5

type View = "list" | "count"

export function StockPanel() {
  const [view, setView] = useState<View>("list")
  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60">
        <SubTab active={view === "list"}  onClick={() => setView("list")}  icon={<Boxes className="w-3.5 h-3.5" />}          label="Stok Listesi" />
        <SubTab active={view === "count"} onClick={() => setView("count")} icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Aylık Sayım" />
      </div>
      {view === "list" ? <StockList /> : <MonthlyCount />}
    </div>
  )
}

// ─── Live stock list + restock ───────────────────────────────────────────────

function StockList() {
  const [rows, setRows] = useState<StockProduct[] | null>(null)
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => { setRows(await listStockProducts()) }, [])
  useEffect(() => { void refresh() }, [refresh])

  const filtered = useMemo(() => {
    const list = rows ?? []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((p) => p.name.toLowerCase().includes(q))
  }, [rows, search])

  async function restock(p: StockProduct) {
    const raw = window.prompt(`"${p.name}" için kaç adet stok eklensin?`, "10")
    if (raw == null) return
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n === 0) { toast.error("Geçerli bir adet gir"); return }
    setBusyId(p.id)
    try {
      await adjustStock(p.id, n, "restock", "Stok girişi")
      toast.success(`${p.name} · ${n > 0 ? "+" : ""}${n} stok`)
      await refresh()
    } catch (e) {
      toast.error("Stok güncellenemedi: " + (e instanceof Error ? e.message : ""))
    } finally { setBusyId(null) }
  }

  const lowCount = (rows ?? []).filter((p) => p.stockOnHand <= LOW_STOCK).length

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün ara…"
            className="flex-1 text-sm bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500" />
        </div>
        {rows && lowCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" /> {lowCount} ürün düşük stok
          </span>
        )}
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
                <th className="px-4 py-2 font-bold text-right pr-4">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const low = p.stockOnHand <= LOW_STOCK
                return (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{p.name}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={cn(
                        "inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-lg text-sm font-bold",
                        p.stockOnHand < 0 ? "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        : low ? "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                      )}>{formatNumberTR(p.stockOnHand)}</span>
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
              {filtered.length === 0 && <tr><td colSpan={3} className="py-10 text-center text-sm text-slate-400">Ürün yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}
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
