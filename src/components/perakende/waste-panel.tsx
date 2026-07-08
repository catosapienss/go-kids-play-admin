"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Trash2, PackageX, Minus, Plus, Loader2, AlertCircle, Send, Clock,
} from "lucide-react"
import { cn, formatTRY } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { listProducts } from "@/lib/services/retail"
import {
  createWaste, listTodayWaste, deleteWaste,
} from "@/lib/services/retail-waste.service"
import {
  WASTE_REASON_LABELS, WASTE_REASON_OPTIONS,
  type WasteReason, type RetailWaste,
} from "@/types/retail-waste"
import type { Product } from "@/types/retail"

// ─── Perakende · Zayiat (retail loss) ────────────────────────────────────────
//
// Record retail stock that can no longer be sold (damaged, expired, lost,
// count difference, sample). A loss is valued at the product's cost price when
// available, else its sale price. Independent of sales revenue.

function hm(iso: string): string {
  const d = new Date(iso); const p = (n: number) => (n < 10 ? "0" + n : String(n))
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
function unitCostOf(p: Product): number {
  return p.costPrice != null && p.costPrice > 0 ? p.costPrice : p.salePrice
}

export function WastePanel() {
  const { user } = useAuth()
  const isManager = !!user && ["manager", "admin", "super_admin"].includes(user.role)

  const [products, setProducts] = useState<Product[] | null>(null)
  const [rows, setRows] = useState<RetailWaste[] | null>(null)
  const [search, setSearch] = useState("")
  const [productId, setProductId] = useState<string>("")
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState<WasteReason | "">("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setRows(await listTodayWaste())
  }, [])

  useEffect(() => {
    let cancelled = false
    listProducts({ onlyActive: true })
      .then((p) => { if (!cancelled) setProducts(p) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Ürünler yüklenemedi") })
    void refresh()
    return () => { cancelled = true }
  }, [refresh])

  const selected = useMemo(() => products?.find((p) => p.id === productId) ?? null, [products, productId])
  const unitCost = selected ? unitCostOf(selected) : 0
  const lineCost = unitCost * qty

  const filtered = useMemo(() => {
    const list = products ?? []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, search])

  const todayTotal = useMemo(() => (rows ?? []).reduce((s, r) => s + r.totalCost, 0), [rows])
  const todayQty   = useMemo(() => (rows ?? []).reduce((s, r) => s + r.quantity, 0), [rows])

  async function submit() {
    if (!user) { toast.error("Oturum bulunamadı"); return }
    if (!selected) { setError("Ürün seç"); return }
    if (!reason) { setError("Zayiat sebebi seç (zorunlu)"); return }
    if (qty <= 0) { setError("Adet 0'dan büyük olmalı"); return }
    if (reason === "other" && !note.trim()) { setError("Sebep notu gir"); return }
    setSaving(true); setError(null)
    try {
      await createWaste({
        productId: selected.id,
        productName: selected.name,
        quantity: qty,
        unitCost,
        reason,
        note: note.trim() || null,
        createdBy: user.id,
        createdByName: user.fullName,
      })
      toast.success(`Zayiat kaydedildi · ${selected.name} × ${qty}`)
      setProductId(""); setQty(1); setReason(""); setNote(""); setSearch("")
      await refresh()
    } catch (e) {
      toast.error("Zayiat kaydedilemedi: " + (e instanceof Error ? e.message.slice(0, 120) : ""))
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    try { await deleteWaste(id); await refresh() }
    catch (e) { toast.error("Silinemedi: " + (e instanceof Error ? e.message : "")) }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-4">
      {/* ── Record form ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <PackageX className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Zayiat Kaydı</h2>
            <p className="text-[11px] text-slate-500">Satılamayacak ürünleri buradan düş</p>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </div>
        )}

        {/* Product picker */}
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Ürün</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ürün ara…"
          className="w-full mb-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-rose-400"
        />
        {products === null ? (
          <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-0.5 mb-4">
            {filtered.slice(0, 30).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setProductId(p.id); setError(null) }}
                className={cn(
                  "text-left rounded-xl px-2.5 py-2 border transition-colors",
                  productId === p.id
                    ? "border-rose-400 bg-rose-50 dark:bg-rose-500/10"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-rose-300",
                )}
              >
                <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                <p className="text-[10px] text-slate-500 tabular-nums">
                  Maliyet ₺{unitCostOf(p).toLocaleString("tr-TR")}
                </p>
              </button>
            ))}
            {filtered.length === 0 && <p className="col-span-3 text-xs text-slate-400 text-center py-3">Ürün yok</p>}
          </div>
        )}

        {/* Qty + reason + note */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Adet</label>
            <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"><Minus className="w-3.5 h-3.5" /></button>
              <span className="w-10 text-center text-sm font-bold tabular-nums">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="w-8 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Zayiat Değeri</label>
            <p className="h-9 flex items-center text-lg font-black tabular-nums text-rose-600 dark:text-rose-400">−{formatTRY(lineCost)}</p>
          </div>
        </div>

        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Sebep</label>
        <select
          value={reason}
          onChange={(e) => { setReason(e.target.value as WasteReason | ""); setError(null) }}
          className={cn(
            "w-full mb-3 px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:border-rose-400",
            reason ? "border-slate-200 dark:border-slate-700" : "border-rose-300 dark:border-rose-500/50",
          )}
        >
          <option value="">Sebep seç… (zorunlu)</option>
          {WASTE_REASON_OPTIONS.map((k) => <option key={k} value={k}>{WASTE_REASON_LABELS[k]}</option>)}
        </select>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={reason === "other" ? "Sebep notu (zorunlu)…" : "Not (opsiyonel)…"}
          className="w-full mb-4 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-rose-400"
        />

        <button
          onClick={submit}
          disabled={saving || !selected}
          className={cn(
            "w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all",
            saving || !selected ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-500/20",
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {saving ? "Kaydediliyor…" : "Zayiat Kaydet"}
        </button>
      </div>

      {/* ── Today's waste list ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col h-fit lg:sticky lg:top-4">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Bugünkü Zayiat</p>
            <p className="text-[11px] text-slate-500">{rows ? `${rows.length} kayıt · ${todayQty} adet` : "…"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Toplam</p>
            <p className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">−{formatTRY(todayTotal)}</p>
          </div>
        </div>
        <div className="p-3 max-h-[60vh] overflow-y-auto">
          {rows === null ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
              <Clock className="w-6 h-6 opacity-40" />
              Bugün zayiat kaydı yok
            </div>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((w) => (
                <li key={w.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {w.productName} <span className="text-slate-400">× {w.quantity}</span>
                    </p>
                    <p className="text-[10.5px] text-slate-500">
                      <span className="font-semibold text-rose-600 dark:text-rose-400">{WASTE_REASON_LABELS[w.reason]}</span>
                      {" · "}{hm(w.createdAt)}{w.createdByName ? ` · ${w.createdByName}` : ""}
                      {w.note ? ` · ${w.note}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">−{formatTRY(w.totalCost)}</span>
                  {(isManager || w.createdBy === user?.id) && (
                    <button onClick={() => remove(w.id)} className="p-1 text-slate-400 hover:text-rose-500" aria-label="Sil">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
