"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Printer, User, Users, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useSettings, useSettingsSection } from "@/lib/settings/settings-store"
import type { ChildEntry, Customer } from "@/types/hizli-kayit"
import {
  printLabels, type LabelJob, type ChildLabelData, type ParentLabelData,
} from "@/lib/print/labels"

interface Props {
  customer:      Customer
  kidsList:      ChildEntry[]
  sessionNumber: string
}

function durationLabel(d: ChildEntry["duration"]): string {
  if (d === "free" || d == null) return "Sınırsız"
  return `${d} Dakika`
}

// ─── Print Buttons ────────────────────────────────────────────────────────────
//
// Three-button bar shown in the post-registration success modal. Each button
// opens the browser print dialog targeting the configured thermal printer
// (operator chooses XP-470B in the dialog).
//
// • Child Label  → one label per child (start–end, duration, session #)
// • Parent Label → one label per child carrying parent+phone+session
// • Both         → child labels followed by parent labels
//
// If `printer.autoPrintEnabled` is on, "Print Both" auto-fires once on mount.

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n)
}

function formatHM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function buildChildJobs(kids: ChildEntry[]): LabelJob[] {
  const now = new Date()
  return kids.map<LabelJob>((child) => {
    const isFree = child.duration === "free" || child.duration == null
    const minutes = typeof child.duration === "number" ? child.duration : 0
    const end = isFree ? null : new Date(now.getTime() + minutes * 60_000)
    const data: ChildLabelData = {
      childName: (child.name || "—").trim(),
      startTime: formatHM(now),
      endTime:   end ? formatHM(end) : "Sınırsız",
    }
    return { kind: "child", data }
  })
}

function buildParentJobs(kids: ChildEntry[], companyPhone: string): LabelJob[] {
  const now = new Date()
  return kids.map<LabelJob>((child) => {
    const isFree = child.duration === "free" || child.duration == null
    const minutes = typeof child.duration === "number" ? child.duration : 0
    const end = isFree ? null : new Date(now.getTime() + minutes * 60_000)
    const data: ParentLabelData = {
      childName:     (child.name || "—").trim(),
      companyPhone:  companyPhone || "—",
      durationLabel: durationLabel(child.duration),
      startTime:     formatHM(now),
      endTime:       end ? formatHM(end) : "Sınırsız",
    }
    return { kind: "parent", data }
  })
}

export function PrintButtons({ customer: _customer, kidsList, sessionNumber: _sessionNumber }: Props) {
  const printer = useSettingsSection("printer")
  const { settings } = useSettings()
  const companyPhone = settings.general.businessPhone
  const [busy, setBusy] = useState<"child" | "parent" | "both" | null>(null)
  const autoFiredRef = useRef(false)

  const childJobs  = useMemo(() => buildChildJobs(kidsList),                [kidsList])
  const parentJobs = useMemo(() => buildParentJobs(kidsList, companyPhone), [kidsList, companyPhone])

  async function run(which: "child" | "parent" | "both") {
    if (busy) return
    setBusy(which)
    try {
      const jobs =
        which === "child"  ? childJobs :
        which === "parent" ? parentJobs :
                              [...childJobs, ...parentJobs]
      if (jobs.length === 0) {
        toast.warning("Yazdırılacak etiket yok")
        return
      }
      await printLabels(jobs, printer)
    } catch (e) {
      toast.error("Yazdırma başlatılamadı", {
        description: e instanceof Error ? e.message.slice(0, 120) : undefined,
      })
    } finally {
      setBusy(null)
    }
  }

  // Optional auto-print on success modal mount
  useEffect(() => {
    if (autoFiredRef.current) return
    if (!printer.autoPrintEnabled) return
    autoFiredRef.current = true
    void run("both")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printer.autoPrintEnabled])

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <PrintBtn icon={User}   label="Çocuk"   onClick={() => run("child")}  busy={busy === "child"}  disabled={!!busy} />
      <PrintBtn icon={Users}  label="Veli"    onClick={() => run("parent")} busy={busy === "parent"} disabled={!!busy} />
      <PrintBtn icon={Printer} label="İkisi"  onClick={() => run("both")}   busy={busy === "both"}   disabled={!!busy} primary />
    </div>
  )
}

function PrintBtn({ icon: Icon, label, onClick, busy, disabled, primary }: {
  icon: typeof Printer; label: string; onClick: () => void;
  busy: boolean; disabled: boolean; primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-[40px] py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        primary
          ? "bg-violet-600 text-white hover:bg-violet-500"
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700",
      )}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}
