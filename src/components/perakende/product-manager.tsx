"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, Check, X, Eye, EyeOff,
  Loader2, AlertCircle, ShoppingBag,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { listProducts, createProduct, updateProduct, deleteProduct } from "@/lib/services/retail"
import {
  PRODUCT_CATEGORY_LABELS, PRODUCT_CATEGORY_COLORS,
} from "@/types/retail"
import type { Product, ProductCategory } from "@/types/retail"
import { cn } from "@/lib/utils"

// ─── Product manager ─────────────────────────────────────────────────────────
//
// Admin-only product catalogue editor for the retail module. RLS enforces
// the write restriction server-side too — non-admins get a read-only view.

const CATEGORY_OPTIONS: ProductCategory[] = ["genel", "corap", "boyama", "oyuncak", "atistirmalik", "icecek"]

interface Draft {
  name: string
  category: ProductCategory
  price: string
  isActive: boolean
}

const EMPTY: Draft = { name: "", category: "genel", price: "", isActive: true }

export function ProductManager() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "super_admin"

  const [rows, setRows] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setRows(await listProducts())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  async function add() {
    const price = Number(draft.price)
    if (!draft.name.trim()) return toast.error("Ürün adı zorunlu")
    if (!Number.isFinite(price) || price < 0) return toast.error("Geçerli fiyat gir")
    try {
      await createProduct({
        name:      draft.name.trim(),
        category:  draft.category,
        salePrice: price,
        isActive:  draft.isActive,
      })
      toast.success("Ürün eklendi")
      setDraft(EMPTY); setCreating(false)
      await reload()
    } catch (e) {
      toast.error("Eklenemedi: " + (e instanceof Error ? e.message.slice(0, 120) : ""))
    }
  }

  async function remove(p: Product) {
    if (!confirm(`"${p.name}" silinsin mi?`)) return
    try {
      await deleteProduct(p.id)
      toast.success("Ürün silindi")
      await reload()
    } catch (e) {
      toast.error("Silinemedi (satışta kullanılmış olabilir)")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ShoppingBag className="w-5 h-5 text-violet-500" />
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Ürünler</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {loading ? "Yükleniyor…" : `${rows.length} ürün · ${rows.filter((r) => r.isActive).length} aktif`}
          </p>
        </div>
        {!isAdmin && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Sadece görüntüleme
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
        </div>
      )}

      {!loading && !error && rows.length === 0 && !creating && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
          Henüz ürün tanımlanmamış.
          {isAdmin && (
            <button onClick={() => setCreating(true)} className="block mx-auto mt-2 font-bold text-violet-600 hover:text-violet-500">
              İlk ürünü ekle →
            </button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {rows.map((p) => (
          <ProductRow
            key={p.id}
            row={p}
            isAdmin={isAdmin}
            editing={editingId === p.id}
            onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
            onChanged={reload}
            onDelete={() => void remove(p)}
          />
        ))}
      </div>

      {isAdmin && (creating ? (
        <div className="rounded-2xl border-2 border-violet-300 dark:border-violet-500/40 bg-violet-50/40 dark:bg-violet-500/[0.04] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-violet-700 dark:text-violet-300">Yeni Ürün</p>
            <button onClick={() => { setCreating(false); setDraft(EMPTY) }} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Ürün adı"
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm sm:col-span-1"
            />
            <select
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as ProductCategory }))}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{PRODUCT_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step={10}
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
              placeholder="Fiyat ₺"
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
              className="rounded"
            />
            Aktif (kasiyer satış ekranında görünsün)
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setCreating(false); setDraft(EMPTY) }} className="text-xs font-semibold px-3 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white">
              İptal
            </button>
            <button onClick={add} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Ürünü kaydet
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-500 hover:text-violet-600 hover:border-violet-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yeni Ürün Ekle
        </button>
      ))}
    </div>
  )
}

// ─── per-row card ────────────────────────────────────────────────────────────

function ProductRow({
  row, isAdmin, editing, onEdit, onChanged, onDelete,
}: {
  row: Product
  isAdmin: boolean
  editing: boolean
  onEdit: () => void
  onChanged: () => void | Promise<void>
  onDelete: () => void
}) {
  const [name, setName]         = useState(row.name)
  const [category, setCategory] = useState<ProductCategory>(row.category)
  const [price, setPrice]       = useState(String(row.salePrice))
  const [busy, setBusy]         = useState(false)

  useEffect(() => {
    if (!editing) {
      setName(row.name); setCategory(row.category); setPrice(String(row.salePrice))
    }
  }, [editing, row])

  async function save() {
    if (!name.trim()) return toast.error("Ürün adı zorunlu")
    const p = Number(price)
    if (!Number.isFinite(p) || p < 0) return toast.error("Geçerli fiyat gir")
    setBusy(true)
    try {
      await updateProduct(row.id, { name: name.trim(), category, salePrice: p })
      toast.success("Ürün güncellendi")
      onEdit()
      await onChanged()
    } catch (e) {
      toast.error("Kaydedilemedi: " + (e instanceof Error ? e.message.slice(0, 100) : ""))
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive() {
    setBusy(true)
    try {
      await updateProduct(row.id, { isActive: !row.isActive })
      toast.success(row.isActive ? "Ürün pasif" : "Ürün aktif")
      await onChanged()
    } catch (e) {
      toast.error("Güncellenemedi")
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="rounded-2xl border-2 border-violet-300 dark:border-violet-500/40 bg-violet-50/40 dark:bg-violet-500/[0.04] p-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{PRODUCT_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step={10}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onEdit} className="text-xs font-semibold px-3 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white">
            İptal
          </button>
          <button onClick={save} disabled={busy} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white inline-flex items-center gap-1.5 disabled:opacity-50">
            <Check className="w-3.5 h-3.5" />
            Kaydet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "rounded-xl border bg-white dark:bg-slate-900 p-3 flex items-center gap-3 transition-colors",
      row.isActive
        ? "border-slate-200 dark:border-slate-800"
        : "border-slate-200 dark:border-slate-800 opacity-60",
    )}>
      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0", PRODUCT_CATEGORY_COLORS[row.category])}>
        {PRODUCT_CATEGORY_LABELS[row.category]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{row.name}</p>
        {!row.isActive && <p className="text-[10px] uppercase tracking-wider font-bold text-rose-500">Pasif</p>}
      </div>
      <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
        ₺{row.salePrice.toLocaleString("tr-TR")}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1">
          <button onClick={toggleActive} disabled={busy} title={row.isActive ? "Pasifleştir" : "Aktifleştir"}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
            {row.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={onEdit} title="Düzenle"
                  className="p-2 rounded-lg text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} title="Sil"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
