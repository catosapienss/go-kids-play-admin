"use client"

// ─── Thermal Label Renderer ──────────────────────────────────────────────────
//
// Builds an isolated, print-only HTML document and triggers window.print()
// in a hidden iframe. The XPrinter XP-470B picks it up via the OS print
// dialog (auto-fires after registration when printer.autoPrintEnabled).
//
// Layout (identical child + parent labels):
//
//   ┌──────────────────────────────────┐
//   │ ALYA                             │
//   │ 25.06.2026                  7    │  ← huge queue number on the right
//   │ 14:32 --- 15:32                  │
//   │                                  │
//   │         0532 542 52 05           │
//   └──────────────────────────────────┘
//
// No logo. No business name. No duration. Local TR phone format.

import type { PrinterSettings } from "@/types/settings"

interface BaseLabelData {
  queueNumber:   string   // "001"… resets per day, see queue-number.ts
  childName:     string
  startDate:     string   // "DD.MM.YYYY"
  startTime:     string   // "HH:mm"
  endTime:       string   // "HH:mm" or "Sınırsız"
  durationLabel: string   // kept for backwards compat with callers; not rendered
  companyPhone:  string
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

/** Local Turkish format: "0532 542 52 05" — no +90 prefix. */
function formatLabelPhone(raw: string): string {
  if (!raw) return ""
  const digits = raw.replace(/\D/g, "")
  let local = digits
  if (local.startsWith("90") && local.length === 12) local = local.slice(2)
  else if (local.startsWith("0") && local.length === 11) local = local.slice(1)
  if (local.length !== 10) return raw
  return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8, 10)}`
}

/** Strip the leading zero from the queue number for the big display. */
function bigQueueDigits(n: string): string {
  const trimmed = (n || "").replace(/^0+/, "")
  return trimmed || "0"
}

function baseCss(printer: PrinterSettings): string {
  const w = printer.labelWidthMm
  const h = printer.labelHeightMm
  return `
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body {
      font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
      /* When sent to an A4 printer (no thermal driver picked yet) the label
         still anchors in the centre of the sheet instead of getting lost in
         a corner. On a real XP-470B the page IS the label, so this is a
         no-op. */
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }

    .label {
      width: ${w}mm;
      height: ${h}mm;
      padding: 2mm 2.5mm;
      page-break-after: always;
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: 1fr auto;
      column-gap: 2mm;
      row-gap: 1mm;
      overflow: hidden;
    }
    .label:last-child { page-break-after: auto; }

    .label .info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1.4mm;
      min-width: 0;
    }
    .label .name {
      font-size: 18pt;
      font-weight: 900;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      word-break: break-word;
    }
    .label .date {
      font-size: 12pt;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.01em;
    }
    .label .times {
      font-size: 13pt;
      font-weight: 900;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.01em;
    }

    .label .queue {
      grid-column: 2;
      grid-row: 1;
      align-self: center;
      justify-self: end;
      font-size: 48pt;
      font-weight: 900;
      line-height: 0.85;
      letter-spacing: -0.04em;
      font-variant-numeric: tabular-nums;
    }

    .label .phone {
      grid-column: 1 / -1;
      grid-row: 2;
      text-align: center;
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
        border-radius: 6px;
      }
    }
  `
}

// ─── HTML builders ───────────────────────────────────────────────────────────

function renderUnifiedLabel(data: BaseLabelData): string {
  const timeRange = data.endTime
    ? `${escapeHtml(data.startTime)} --- ${escapeHtml(data.endTime)}`
    : escapeHtml(data.startTime)

  return `
    <div class="label">
      <div class="info">
        <div class="name">${escapeHtml(data.childName)}</div>
        <div class="date">${escapeHtml(data.startDate || "")}</div>
        <div class="times">${timeRange}</div>
      </div>
      <div class="queue">${escapeHtml(bigQueueDigits(data.queueNumber))}</div>
      <div class="phone">${escapeHtml(formatLabelPhone(data.companyPhone || ""))}</div>
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
  <title> </title>
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
