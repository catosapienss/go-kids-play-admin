"use client"

// ─── Thermal Label Renderer ──────────────────────────────────────────────────
//
// Builds an isolated, print-only HTML document and triggers window.print()
// in a hidden iframe. Operator picks the XPrinter XP-470B from the browser's
// print dialog.
//
// Layout (BOTH child + parent labels, identical):
//
//   ┌──────────────────────────┐
//   │          #001            │  ← queue number (huge)
//   │                          │
//   │          ALYA            │  ← child name
//   │                          │
//   │     14:32 — 15:32        │  ← time range
//   │         60 DK            │  ← duration
//   │     0532 542 52 05       │  ← phone (bottom)
//   └──────────────────────────┘
//
// No logo. No business name. Centred. Sized to the active PrinterSettings.

import type { PrinterSettings } from "@/types/settings"

interface BaseLabelData {
  queueNumber:   string   // "001", "002" … resets per day, see queue-number.ts
  childName:     string
  startTime:     string   // "HH:mm"
  endTime:       string   // "HH:mm" or "Sınırsız"
  durationLabel: string   // "30 DK" / "60 DK" / "SINIRSIZ"
  companyPhone:  string   // shop phone
}

export type ChildLabelData  = BaseLabelData
export type ParentLabelData = BaseLabelData

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function baseCss(printer: PrinterSettings): string {
  const w = printer.labelWidthMm
  const h = printer.labelHeightMm
  return `
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; }

    .label {
      width: ${w}mm;
      height: ${h}mm;
      padding: 1.5mm 2mm;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      overflow: hidden;
    }
    .label:last-child { page-break-after: auto; }

    .label .queue {
      font-size: 36pt;
      font-weight: 900;
      line-height: 0.9;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    .label .name {
      font-size: 24pt;
      font-weight: 900;
      line-height: 0.95;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      word-break: break-word;
    }
    .label .times {
      font-size: 17pt;
      font-weight: 900;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.01em;
    }
    .label .duration {
      font-size: 14pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      line-height: 1;
    }
    .label .phone {
      font-size: 12pt;
      font-weight: 900;
      letter-spacing: 0.03em;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    @media screen {
      body { background: #f1f5f9; padding: 8mm; }
      .label {
        background: #fff;
        border: 1px dashed #94a3b8;
        margin: 0 auto 4mm;
        box-shadow: 0 1px 2px rgba(0,0,0,0.06);
      }
    }
  `
}

// ─── HTML builders ───────────────────────────────────────────────────────────

function renderUnifiedLabel(data: BaseLabelData): string {
  const timeRange = data.endTime
    ? `${escapeHtml(data.startTime)} — ${escapeHtml(data.endTime)}`
    : escapeHtml(data.startTime)
  return `
    <div class="label">
      <div class="queue">#${escapeHtml(data.queueNumber || "—")}</div>
      <div class="name">${escapeHtml(data.childName)}</div>
      <div class="times">${timeRange}</div>
      <div class="duration">${escapeHtml(data.durationLabel)}</div>
      <div class="phone">${escapeHtml(data.companyPhone || "")}</div>
    </div>
  `
}

export function renderChildLabel(data: ChildLabelData): string {
  return renderUnifiedLabel(data)
}

export function renderParentLabel(data: ParentLabelData): string {
  return renderUnifiedLabel(data)
}

// ─── Print trigger ───────────────────────────────────────────────────────────

export type LabelJob =
  | { kind: "child";  data: ChildLabelData }
  | { kind: "parent"; data: ParentLabelData }

export function printLabels(jobs: LabelJob[], printer: PrinterSettings): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (jobs.length === 0) return Promise.resolve()

  const body = jobs.map((j) =>
    j.kind === "child" ? renderChildLabel(j.data) : renderParentLabel(j.data),
  ).join("\n")

  const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>Etiket — ${escapeHtml(printer.printerName || "XP-470B")}</title>
  <style>${baseCss(printer)}</style>
</head>
<body>${body}</body>
</html>`

  return new Promise((resolve) => {
    const iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.position = "fixed"
    iframe.style.right    = "0"
    iframe.style.bottom   = "0"
    iframe.style.width    = "0"
    iframe.style.height   = "0"
    iframe.style.border   = "0"
    iframe.style.opacity  = "0"
    iframe.srcdoc = html

    let resolved = false
    const finish = () => {
      if (resolved) return
      resolved = true
      setTimeout(() => { try { iframe.remove() } catch { /* noop */ } resolve() }, 250)
    }

    iframe.onload = () => {
      const w = iframe.contentWindow
      if (!w) return finish()
      try { w.focus(); w.print() } catch { /* swallow */ }
      w.addEventListener?.("afterprint", finish, { once: true })
      setTimeout(finish, 5000)
    }

    document.body.appendChild(iframe)
  })
}
