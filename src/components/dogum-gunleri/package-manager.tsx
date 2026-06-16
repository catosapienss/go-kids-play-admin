"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Cake, Plus, Pencil, Trash2, Check, X, Eye, EyeOff,
  Loader2, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

// ─── Birthday Package Manager ────────────────────────────────────────────────
//
// Admin-only CRUD for the birthday_packages table.
// Non-admins see a read-only list (the same list the operator uses while
// taking a reservation).

interface PackageRow {
  id: string
  name: string
  description: string | null
  price: number
  isActive: boolean
  sortOrder: number
}

interface DraftPackage {
  name: string
  description: string
  price: string
  isActive: boolean
}

const EMPTY_DRAFT: DraftPackage = { name: "", description: "", price: "", isActive: true }

export function BirthdayPackageManager() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "super_admin"

  const [rows, setRows] = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<DraftPackage>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("birthday_packages")
      .select("id, name, description, price, is_active, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setRows(
      (data ?? []).map((r) => ({
        id: r.id as string,
        name: (r.name as string) ?? "",
        description: (r.description as string | null) ?? null,
        price: Number(r.price ?? 0),
        isActive: (r.is_active as boolean) ?? true,
        sortOrder: Number(r.sort_order ?? 0),
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => { void reload() }, [reload])

  // ── create ────────────────────────────────────────────────────────────────
  async function createPackage() {
    if (!draft.name.trim()) {
      toast.error("Paket adı zorunlu")
      return
    }
    const price = Number(draft.price)
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Geçerli bir fiyat gir")
      return
    }
    const supabase = createClient()
    const maxSort = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0)
    const { error } = await supabase.from("birthday_packages").insert({
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      price,
      is_active: draft.isActive,
      sort_order: maxSort + 10,
    })
    if (error) {
      toast.error("Paket eklenemedi: " + error.message.slice(0, 120))
      return
    }
    toast.success("Paket eklendi")
    setDraft(EMPTY_DRAFT)
    setCreating(false)
    await reload()
  }

  // ── delete ────────────────────────────────────────────────────────────────
  async function deletePackage(id: string, name: string) {
    if (!confirm(`"${name}" paketini sil? Bu işlem geri alınamaz.`)) return
    const supabase = createClient()
    const { error } = await supabase.from("birthday_packages").delete().eq("id", id)
    if (error) {
      toast.error("Silinemedi: " + error.message.slice(0, 120))
      return
    }
    toast.success("Paket silindi")
    await reload()
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white">
          <Cake className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Paketler</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {loading ? "Yükleniyor…" : `${rows.length} paket tanımlı · ${rows.filter((r) => r.isActive).length} aktif`}
          </p>
        </div>
        {!isAdmin && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Sadece görüntüleme
          </span>
        )}
        {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-200">
              <AlertCircle className="w-3.5 h-3.5 inline mr-2" />
              {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && !creating && (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
              Henüz paket tanımlanmamış.
              {isAdmin && (
                <p className="mt-2">
                  <button
                    onClick={() => setCreating(true)}
                    className="font-semibold text-pink-600 hover:text-pink-500"
                  >
                    İlk paketi ekle →
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Package list */}
          <div className="space-y-2">
            {rows.map((row) => (
              <PackageRowItem
                key={row.id}
                row={row}
                isAdmin={isAdmin}
                editing={editingId === row.id}
                onEditToggle={() => setEditingId((id) => (id === row.id ? null : row.id))}
                onChanged={reload}
                onDelete={() => void deletePackage(row.id, row.name)}
              />
            ))}
          </div>

          {/* Inline create form */}
          {isAdmin && (creating ? (
            <div className="rounded-xl border-2 border-pink-300 dark:border-pink-500/40 bg-pink-50/40 dark:bg-pink-500/[0.04] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-pink-700 dark:text-pink-300">Yeni Paket</p>
                <button onClick={() => { setCreating(false); setDraft(EMPTY_DRAFT) }} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Paket adı (örn. Altın Paket)"
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={draft.price}
                  onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                  placeholder="Fiyat (₺)"
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Paket içeriği — pasta, dekorasyon, ikram, oyun süresi…"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"
              />
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                  className="rounded"
                />
                Aktif (rezervasyon ekranında görünsün)
              </label>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setCreating(false); setDraft(EMPTY_DRAFT) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  İptal
                </button>
                <button
                  onClick={createPackage}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Paketi kaydet
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-500 hover:text-pink-600 hover:border-pink-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Yeni Paket Ekle
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── per-row inline editor ───────────────────────────────────────────────────

function PackageRowItem({
  row, isAdmin, editing, onEditToggle, onChanged, onDelete,
}: {
  row: PackageRow
  isAdmin: boolean
  editing: boolean
  onEditToggle: () => void
  onChanged: () => void | Promise<void>
  onDelete: () => void
}) {
  const [name, setName] = useState(row.name)
  const [description, setDescription] = useState(row.description ?? "")
  const [price, setPrice] = useState(String(row.price))
  const [busy, setBusy] = useState(false)

  // Re-sync local state when the parent reloads the row.
  useEffect(() => {
    if (!editing) {
      setName(row.name)
      setDescription(row.description ?? "")
      setPrice(String(row.price))
    }
  }, [row, editing])

  async function save() {
    if (!name.trim()) { toast.error("Paket adı zorunlu"); return }
    const p = Number(price)
    if (!Number.isFinite(p) || p < 0) { toast.error("Geçerli fiyat gir"); return }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("birthday_packages")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        price: p,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    setBusy(false)
    if (error) { toast.error("Kaydedilemedi: " + error.message.slice(0, 100)); return }
    toast.success("Paket güncellendi")
    onEditToggle()
    await onChanged()
  }

  async function toggleActive() {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("birthday_packages")
      .update({ is_active: !row.isActive })
      .eq("id", row.id)
    setBusy(false)
    if (error) { toast.error("Güncellenemedi: " + error.message.slice(0, 100)); return }
    toast.success(row.isActive ? "Paket pasif" : "Paket aktif")
    await onChanged()
  }

  if (editing) {
    return (
      <div className="rounded-xl border-2 border-violet-300 dark:border-violet-500/40 bg-violet-50/40 dark:bg-violet-500/[0.04] p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Paket adı"
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
          <input
            type="number"
            min={0}
            step={50}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Fiyat (₺)"
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Açıklama"
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onEditToggle} className="text-xs font-semibold px-3 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white">
            İptal
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            Kaydet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "rounded-xl border bg-white dark:bg-slate-900 p-4 flex items-start gap-3 transition-colors",
      row.isActive
        ? "border-slate-200 dark:border-slate-800"
        : "border-slate-200 dark:border-slate-800 opacity-60",
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{row.name}</h4>
          {row.isActive ? (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              Aktif
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
              Pasif
            </span>
          )}
        </div>
        {row.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            {row.description}
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
          ₺{row.price.toLocaleString("tr-TR")}
        </p>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggleActive}
            disabled={busy}
            title={row.isActive ? "Pasifleştir" : "Aktifleştir"}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {row.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={onEditToggle}
            title="Düzenle"
            className="p-2 rounded-lg text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            title="Sil"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
