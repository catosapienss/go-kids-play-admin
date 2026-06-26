"use client"

import { useState } from "react"
import { Printer, User, Loader2, Eye, Phone, AlertCircle } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { cn } from "@/lib/utils"
import { useSettings, useSettingsSection } from "@/lib/settings/settings-store"
import {
  printLabels, renderChildLabel, renderParentLabel,
  type LabelJob, type ChildLabelData, type ParentLabelData,
} from "@/lib/print/labels"

// ─── /printer-test — Sample Label Printer ───────────────────────────────────
//
// Lets the operator dry-run the XPrinter XP-470B without touching any
// production data. Edit the sample fields → preview live → fire the same
// printLabels() helper that the post-registration auto-print uses.
//
// IMPORTANT: nothing on this page writes to Supabase. No session/payment/
// customer is created. Safe to spam during printer setup.

const DEFAULT_BASE = {
  childName:     "ARELA",
  startTime:     "14:43",
  endTime:       "15:43",
  durationLabel: "60 DK",
}

export default function PrinterTestPage() {
  const printer = useSettingsSection("printer")
  const { settings } = useSettings()
  const fallbackPhone = settings.general.businessPhone || "+90 532 542 5205"

  // Child + parent labels now share the same shape. Editing one updates both
  // previews — they print identically on purpose.
  const [child, setChild]   = useState<ChildLabelData>({ ...DEFAULT_BASE, companyPhone: fallbackPhone })
  const [parent, setParent] = useState<ParentLabelData>({ ...DEFAULT_BASE, companyPhone: fallbackPhone })
  const [busy, setBusy]     = useState<"child" | "parent" | "both" | null>(null)

  async function run(which: "child" | "parent" | "both") {
    if (busy) return
    setBusy(which)
    try {
      const jobs: LabelJob[] =
        which === "child"  ? [{ kind: "child",  data: child }] :
        which === "parent" ? [{ kind: "parent", data: parent }] :
                             [{ kind: "child", data: child }, { kind: "parent", data: parent }]
      await printLabels(jobs, printer)
    } finally {
      setBusy(null)
    }
  }

  // Inline previews share the renderer with the printer. The CSS below mirrors
  // baseCss() in src/lib/print/labels.tsx so the on-screen sticker matches
  // what the thermal printer puts out.
  const childHtml  = renderChildLabel(child)
  const parentHtml = renderParentLabel(parent)
  const previewCss = `
    .preview { background:#fff; color:#000; border:1px dashed #94a3b8; border-radius:4px;
               box-shadow:0 1px 2px rgba(0,0,0,0.06); overflow:hidden;
               width:${printer.labelWidthMm}mm; height:${printer.labelHeightMm}mm;
               font-family:-apple-system,'Helvetica Neue',Arial,sans-serif; }
    .preview .label { position:relative; width:100%; height:100%; padding:2mm 2.5mm 1.5mm;
                      display:flex; flex-direction:column; align-items:center;
                      justify-content:flex-start; text-align:center; box-sizing:border-box; }
    .preview .logo  { position:absolute; top:1.5mm; left:2mm; width:9mm; height:9mm; object-fit:contain; }
    .preview .brand { width:100%; font-size:8pt; font-weight:900; letter-spacing:0.08em;
                      text-transform:uppercase; text-align:right; line-height:1; }
    .preview .name  { margin-top:1.5mm; font-size:26pt; font-weight:900; line-height:0.95;
                      text-transform:uppercase; letter-spacing:0.04em; word-break:break-word; }
    .preview .times { margin-top:1.5mm; font-size:19pt; font-weight:900; line-height:1.05;
                      font-variant-numeric:tabular-nums; letter-spacing:0.02em; }
    .preview .duration { margin-top:1mm; font-size:15pt; font-weight:800;
                         text-transform:uppercase; letter-spacing:0.05em; }
    .preview .phone { margin-top:auto; padding-top:1mm; font-size:13pt; font-weight:900;
                      letter-spacing:0.03em; font-variant-numeric:tabular-nums; }
  `

  return (
    <MainLayout title="Yazıcı Testi" subtitle="Operasyonel veriye dokunmadan XPrinter XP-470B testi">
      <style dangerouslySetInnerHTML={{ __html: previewCss }} />

      <div className="max-w-5xl mx-auto space-y-5">
        {/* Heads-up banner */}
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Test sayfası</p>
            <p className="text-xs text-amber-800 dark:text-amber-200/80 mt-0.5">
              Bu sayfa yalnızca etiket biçimini doğrulamak içindir. Hiçbir oturum, ödeme veya müşteri kaydı oluşturmaz.
              Yazdırma diyaloğunda <strong>{printer.printerName || "XP-470B"}</strong> seçeneğini seç.
            </p>
          </div>
        </div>

        {/* Single editor — child + parent labels are identical */}
        <Panel
          title="Etiket"
          icon={<User className="w-4 h-4" />}
          previewHtml={childHtml}
          onPrint={() => run("child")}
          busy={busy === "child"}
          disabled={!!busy}
        >
          <LabeledInput label="Çocuk adı" value={child.childName}
            onChange={(v) => { const next = { ...child, childName: v }; setChild(next); setParent({ ...parent, childName: v }) }}
            icon={<User className="w-3.5 h-3.5"/>} />
          <div className="grid grid-cols-2 gap-2">
            <LabeledInput label="Giriş" value={child.startTime}
              onChange={(v) => { setChild({ ...child, startTime: v }); setParent({ ...parent, startTime: v }) }} placeholder="HH:mm" />
            <LabeledInput label="Çıkış" value={child.endTime}
              onChange={(v) => { setChild({ ...child, endTime: v }); setParent({ ...parent, endTime: v }) }} placeholder="HH:mm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LabeledInput label="Süre" value={child.durationLabel}
              onChange={(v) => { setChild({ ...child, durationLabel: v }); setParent({ ...parent, durationLabel: v }) }} placeholder="60 DK" />
            <LabeledInput label="Telefon" value={child.companyPhone}
              onChange={(v) => { setChild({ ...child, companyPhone: v }); setParent({ ...parent, companyPhone: v }) }}
              icon={<Phone className="w-3.5 h-3.5"/>} />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Çocuk ve veli etiketleri aynı tasarımı kullanır — her ikisi de identik basılır.
          </p>
        </Panel>

        {/* Hidden parent panel kept to preserve previewHtml exposure for future divergence */}
        <div className="sr-only" aria-hidden>{parentHtml}</div>

        {/* Combined print + settings recap */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-slate-500 mb-0.5">Yazıcı</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {printer.printerName} · {printer.labelWidthMm}mm × {printer.labelHeightMm}mm
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Otomatik yazdırma:&nbsp;
                <strong className={printer.autoPrintEnabled ? "text-emerald-600" : "text-slate-500"}>
                  {printer.autoPrintEnabled ? "Açık" : "Kapalı"}
                </strong>
                {" · "}
                Şirket telefonu: <strong>{fallbackPhone}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => run("both")}
              disabled={!!busy}
              className={cn(
                "min-h-[44px] px-5 rounded-xl text-sm font-bold inline-flex items-center gap-2",
                busy ? "bg-slate-300 dark:bg-slate-700 text-slate-500" : "bg-violet-600 hover:bg-violet-500 text-white",
              )}
            >
              {busy === "both" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              İkisini Birden Yazdır
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Panel({
  title, icon, children, previewHtml, onPrint, busy, disabled,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode
  previewHtml: string; onPrint: () => void; busy: boolean; disabled: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-4 p-5">
        <div className="space-y-2.5">{children}</div>
        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-slate-400">
            <Eye className="w-3 h-3" /> Önizleme
          </div>
          <div className="preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          <button
            type="button"
            onClick={onPrint}
            disabled={disabled}
            className={cn(
              "self-stretch min-h-[40px] py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5",
              disabled ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
                       : "bg-emerald-600 hover:bg-emerald-500 text-white",
            )}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            Yazdır
          </button>
        </div>
      </div>
    </div>
  )
}

function LabeledInput({
  label, value, onChange, placeholder, icon,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; icon?: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <div className="relative">
        {icon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-violet-500",
            icon ? "pl-8 pr-3" : "px-3",
          )}
        />
      </div>
    </label>
  )
}
