"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Printer, User, Users, Loader2, X, Clock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useSettings, useSettingsSection } from "@/lib/settings/settings-store"
import { printLabels, type LabelJob, type ChildLabelData, type ParentLabelData } from "@/lib/print/labels"
import { getOrAssignSessionQueueNumber } from "@/lib/print/queue-number"
import type { ActiveSession } from "@/types/aktif-oyun"

// ─── Reprint Labels — active session reprint trigger ─────────────────────────
//
// Operators occasionally need to reprint child/parent labels (lost, damaged,
// extra copy, etc.). This button opens a small popover from inside the action
// bar of an Active Session card and offers three reprint options.
//
// Labels are reconstructed live from the current ActiveSession data — start
// time + duration → end time, fresh on every click. Session data itself is
// NEVER mutated; the only side-effect is a localStorage audit counter
// (per-session) so we can later show "Son yazdırma · 4 kez" for support
// scenarios. Nothing hits the DB.

const STORAGE_KEY = "gkp:labels:reprints:v1"

interface AuditEntry { lastAt: number; count: number }
type AuditMap = Record<string, AuditEntry>

function loadAudit(): AuditMap {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as AuditMap }
  catch { return {} }
}
function saveAudit(map: AuditMap): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map)) } catch { /* swallow */ }
}

// Map ActiveSession to label jobs using the *current* end-time math —
// remainingSeconds is authoritative because it already accounts for pauses
// and extensions. For unlimited sessions we print "Sınırsız" for end time.
function buildJobs(session: ActiveSession, companyPhone: string): { child: LabelJob; parent: LabelJob } {
  const isUnlimited =
    session.packageType === "Serbest" || session.totalMinutes === 0
  const now = new Date()
  const end = isUnlimited
    ? null
    : new Date(now.getTime() + Math.max(0, session.remainingSeconds) * 1000)
  const endStr = end ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : "Sınırsız"
  const durationLabel = isUnlimited
    ? "Sınırsız"
    : `${session.totalMinutes} Dakika`

  const shared: ChildLabelData = {
    // Server-assigned atomic daily number is the source of truth. Fall back to
    // the legacy per-session client counter only for sessions that predate
    // migration 020 (dailySeq null) so reprint never breaks.
    queueNumber:   session.dailySeq != null
      ? String(session.dailySeq)
      : getOrAssignSessionQueueNumber(session.id),
    childName:     (session.childName || "—").trim(),
    startDate:     `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`,
    startTime:     session.entryTime,
    endTime:       endStr,
    durationLabel: shortDurationLabel(durationLabel),
    companyPhone:  companyPhone || "",
  }
  return {
    child:  { kind: "child",  data: shared },
    parent: { kind: "parent", data: shared as ParentLabelData },
  }
}

function shortDurationLabel(label: string): string {
  // "60 Dakika" → "60 DK", "Sınırsız" stays as-is.
  return label.replace(/\sDakika$/i, " DK").toUpperCase()
}

function pad(n: number): string { return n < 10 ? "0" + n : String(n) }

function formatRelativeTr(ts: number): string {
  const diffSec = Math.round((Date.now() - ts) / 1000)
  if (diffSec < 60)     return `${diffSec}s önce`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60)     return `${diffMin} dk önce`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24)       return `${diffH} sa önce`
  const d = new Date(ts)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props { session: ActiveSession }

export function ReprintLabelsButton({ session }: Props) {
  const printer = useSettingsSection("printer")
  const { settings } = useSettings()
  // Fall back to the production phone if the user happens to have an empty
  // string in settings (e.g. cleared the field by mistake) — the label
  // bottom line should never be blank in production.
  const companyPhone = settings.general.businessPhone || "+90 532 542 5205"
  const [open, setOpen]   = useState(false)
  const [busy, setBusy]   = useState<"child" | "parent" | "both" | null>(null)
  const [audit, setAudit] = useState<AuditEntry | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  const jobs = useMemo(() => buildJobs(session, companyPhone), [session, companyPhone])

  // Hydrate this session's audit row from localStorage on open.
  useEffect(() => {
    if (!open) return
    setAudit(loadAudit()[session.id] ?? null)
  }, [open, session.id])

  // Click-away close.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown",   onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown",   onKey)
    }
  }, [open])

  function bumpAudit(): void {
    const map = loadAudit()
    const prev = map[session.id] ?? { lastAt: 0, count: 0 }
    const next: AuditEntry = { lastAt: Date.now(), count: prev.count + 1 }
    map[session.id] = next
    saveAudit(map)
    setAudit(next)
  }

  async function run(which: "child" | "parent" | "both"): Promise<void> {
    if (busy) return
    setBusy(which)
    try {
      const labelJobs: LabelJob[] =
        which === "child"  ? [jobs.child] :
        which === "parent" ? [jobs.parent] :
                              [jobs.child, jobs.parent]
      await printLabels(labelJobs, printer)
      bumpAudit()
      toast.success(
        which === "child" ? "Çocuk etiketi yazdırılıyor" :
        which === "parent" ? "Veli etiketi yazdırılıyor" :
                              "Her iki etiket yazdırılıyor",
      )
    } catch (e) {
      toast.error("Yazdırma başlatılamadı", {
        description: e instanceof Error ? e.message.slice(0, 120) : undefined,
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95",
          open
            ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
            : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300",
        )}
        aria-label="Etiket yazdır"
        title="Etiket yazdır"
      >
        <Printer className="w-3 h-3" />
        Etiket
      </button>

      {open && (
        <div
          className="absolute z-30 right-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 animate-in fade-in slide-in-from-top-1 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-1.5 pb-1.5 mb-1 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Yeniden Yazdır
            </p>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <PopoverBtn icon={User}    label="Çocuk Etiketi"      busy={busy === "child"}  disabled={!!busy} onClick={() => run("child")} />
            <PopoverBtn icon={Users}   label="Veli Etiketi"       busy={busy === "parent"} disabled={!!busy} onClick={() => run("parent")} />
            <PopoverBtn icon={Printer} label="İki Etiket Birlikte" busy={busy === "both"}   disabled={!!busy} onClick={() => run("both")} primary />
          </div>

          {audit && audit.count > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 px-1.5 text-[10px] text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>
                Son yazdırma: <strong className="text-slate-600 dark:text-slate-300">{formatRelativeTr(audit.lastAt)}</strong>
                {" · "}
                <strong className="text-slate-600 dark:text-slate-300">{audit.count}</strong> kez
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PopoverBtn({
  icon: Icon, label, onClick, busy, disabled, primary,
}: {
  icon: typeof Printer; label: string; onClick: () => void;
  busy: boolean; disabled: boolean; primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-semibold transition-colors text-left",
        disabled && "opacity-50 cursor-not-allowed",
        primary
          ? "bg-violet-600 text-white hover:bg-violet-500"
          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
      )}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}
