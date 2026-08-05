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
import { nextQueueNumber } from "@/lib/print/queue-number"

interface Props {
  customer:      Customer
  kidsList:      ChildEntry[]
  sessionNumber: string
  /** Server-assigned atomic daily label numbers, one per child (kidsList order).
   *  When present these are printed verbatim — the single source of truth. The
   *  client-side counter is only a fallback for pre-migration sessions. */
  labelNumbers?: string[]
  /** Active monthly-member Brew Mood coffee discount (%). When > 0 the label
   *  carries a "Brew Mood Coffee %N İndirim" promo line so staff at the coffee
   *  counter can honour it. */
  brewmoodDiscountPct?: number
}

function durationLabel(d: ChildEntry["duration"]): string {
  if (d === "free" || d == null) return "SINIRSIZ"
  return `${d} DK`
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

function formatDMY(d: Date): string {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

// Child + parent labels carry identical data — they print identical
// stickers on purpose so staff doesn't have to keep track of which copy
// is which during busy hours.
function buildSharedData(child: ChildEntry, companyPhone: string, queueNumber: string, promoNote?: string): ChildLabelData {
  const now = new Date()
  const isFree  = child.duration === "free" || child.duration == null
  // The printed end-time must include any campaign gift (e.g. Mon/Wed 60→90),
  // otherwise the sticker undersells what the child actually gets to play.
  const bonusMin = child.campaignBonusMinutes ?? 0
  const minutes = (typeof child.duration === "number" ? child.duration : 0) + bonusMin
  const end     = isFree ? null : new Date(now.getTime() + minutes * 60_000)
  // Per-child promo: a campaign gift takes the line; otherwise fall back to the
  // batch-level note (Brew Mood member discount). The two never co-occur on one
  // child — campaign is a paid slot, the member discount is ₺0 play.
  const campaignNote = bonusMin > 0 ? `Kampanya: +${bonusMin} dk hediye` : undefined
  return {
    queueNumber,
    childName:     (child.name || "—").trim(),
    startDate:     formatDMY(now),
    startTime:     formatHM(now),
    endTime:       end ? formatHM(end) : "SINIRSIZ",
    durationLabel: durationLabel(child.duration),
    companyPhone:  companyPhone || "",
    promoNote:     campaignNote ?? promoNote,
  }
}

/** Build child + parent jobs that SHARE a queue number per child. */
function buildAllJobs(kids: ChildEntry[], companyPhone: string, numbers: string[], promoNote?: string): {
  childJobs:  LabelJob[]
  parentJobs: LabelJob[]
} {
  const shared = kids.map((c, i) => buildSharedData(c, companyPhone, numbers[i], promoNote))
  return {
    childJobs:  shared.map((data): LabelJob => ({ kind: "child",  data })),
    parentJobs: shared.map((data): LabelJob => ({ kind: "parent", data: data as ParentLabelData })),
  }
}

export function PrintButtons({ customer: _customer, kidsList, sessionNumber: _sessionNumber, labelNumbers, brewmoodDiscountPct }: Props) {
  const printer = useSettingsSection("printer")
  const { settings } = useSettings()
  const companyPhone = settings.general.businessPhone || "+90 532 542 5205"
  const promoNote = brewmoodDiscountPct && brewmoodDiscountPct > 0
    ? `Brew Mood Coffee %${brewmoodDiscountPct} İndirim`
    : undefined
  const [busy, setBusy] = useState<"child" | "parent" | "both" | null>(null)
  const autoFiredRef = useRef(false)

  // Prefer the server-assigned atomic daily numbers (migration 020). Only fall
  // back to the legacy client counter for a child whose number is missing
  // (e.g. the column isn't deployed yet) so printing never fails.
  const queueNumbers = useMemo(
    () => kidsList.map((_, i) => {
      const server = labelNumbers?.[i]?.trim()
      return server && server.length > 0 ? server : nextQueueNumber()
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kidsList.length, labelNumbers],
  )
  const { childJobs, parentJobs } = useMemo(
    () => buildAllJobs(kidsList, companyPhone, queueNumbers, promoNote),
    [kidsList, companyPhone, queueNumbers, promoNote],
  )

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
