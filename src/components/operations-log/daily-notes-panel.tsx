"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { NotebookPen, X, Send, Trash2, Pencil, Check, Loader2, Clock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useBranchScope } from "@/lib/branch/branch-context"
import {
  createOperationNote, listTodayOperationNotes, updateOperationNote, deleteOperationNote,
} from "@/lib/services/operations-log.service"
import type { OperationNote } from "@/types/operations-log"

// ─── Daily Notes side panel ──────────────────────────────────────────────────
//
// Fast shift-log drawer opened from the header. Shows today's notes (newest
// first), a quick add box, inline edit of your own note, and delete (own note,
// or any note for manager/admin). Refetches on open + light poll so multiple
// tablets stay roughly in sync.

const QUICK_NOTES = [
  "POS yeniden başlatıldı",
  "Çorap stoğu dolduruldu",
  "Oyun alanı temizlendi",
  "Kasa farkı tespit edildi",
]

function hm(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => (n < 10 ? "0" + n : String(n))
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

interface Props {
  open: boolean
  onClose: () => void
  onCountChange?: (count: number) => void
}

export function DailyNotesPanel({ open, onClose, onCountChange }: Props) {
  const { user } = useAuth()
  const scope = useBranchScope()
  const [notes, setNotes] = useState<OperationNote[] | null>(null)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const isManager = !!user && ["manager", "admin", "super_admin"].includes(user.role)
  const canModify = useCallback(
    (n: OperationNote) => isManager || n.createdBy === user?.id,
    [isManager, user?.id],
  )

  const refresh = useCallback(async () => {
    const rows = await listTodayOperationNotes(scope, "desc")
    setNotes(rows)
    onCountChange?.(rows.length)
  }, [scope, onCountChange])

  // Load on open + poll every 30s while open.
  useEffect(() => {
    if (!open) return
    void refresh()
    setTimeout(() => inputRef.current?.focus(), 50)
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [open, refresh])

  // Escape to close.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !editId) onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, editId, onClose])

  async function add() {
    const text = draft.trim()
    if (!text || saving || !user) return
    setSaving(true)
    try {
      await createOperationNote({
        note: text,
        branchId: scope.branchId ?? user.branchId ?? null,
        createdBy: user.id,
        createdByName: user.fullName,
      })
      setDraft("")
      await refresh()
    } catch (e) {
      toast.error("Not eklenemedi: " + (e instanceof Error ? e.message : ""))
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(id: string) {
    const text = editText.trim()
    if (!text) return
    try {
      await updateOperationNote(id, text)
      setEditId(null)
      await refresh()
    } catch (e) {
      toast.error("Not güncellenemedi: " + (e instanceof Error ? e.message : ""))
    }
  }

  async function remove(id: string) {
    try {
      await deleteOperationNote(id)
      await refresh()
    } catch (e) {
      toast.error("Not silinemedi: " + (e instanceof Error ? e.message : ""))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <aside className="relative ml-auto w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full animate-[slideInRight_180ms_ease-out]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center">
            <NotebookPen className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Günlük Notlar</h2>
            <p className="text-[11px] text-slate-500">Bugünün vardiya notları · {notes?.length ?? 0} kayıt</p>
          </div>
          <button onClick={onClose} aria-label="Kapat" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add box */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add() }}
            rows={2}
            placeholder="Vardiya notu yaz… (örn: Bir oyuncak hasar gördü)"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-violet-500 resize-none"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {QUICK_NOTES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setDraft((d) => d ? d : q)}
                className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10"
              >
                {q}
              </button>
            ))}
            <button
              onClick={add}
              disabled={!draft.trim() || saving}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Ekle
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {notes === null ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
          ) : notes.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
              <Clock className="w-6 h-6 opacity-40" />
              Bugün henüz not eklenmedi.
            </div>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-800/40 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">{hm(n.createdAt)}</span>
                    <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">{n.createdByName ?? "Personel"}</span>
                    {n.updatedAt !== n.createdAt && <span className="text-[10px] text-slate-400">· düzenlendi</span>}
                    {canModify(n) && editId !== n.id && (
                      <div className="ml-auto flex items-center gap-1">
                        {n.createdBy === user?.id && (
                          <button onClick={() => { setEditId(n.id); setEditText(n.note) }} title="Düzenle" className="w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center">
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button onClick={() => remove(n.id)} title="Sil" className="w-6 h-6 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {editId === n.id ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-violet-300 dark:border-violet-500/40 bg-white dark:bg-slate-800 text-sm focus:outline-none resize-none"
                        autoFocus
                      />
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => saveEdit(n.id)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 text-white text-xs font-bold">
                          <Check className="w-3 h-3" /> Kaydet
                        </button>
                        <button onClick={() => setEditId(null)} className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                          Vazgeç
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug whitespace-pre-wrap break-words">{n.note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <style jsx>{`
          @keyframes slideInRight { from { transform: translateX(12px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        `}</style>
      </aside>
    </div>
  )
}
