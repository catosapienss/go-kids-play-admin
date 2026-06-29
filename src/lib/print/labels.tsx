"use client"

// ─── Thermal Label Renderer ──────────────────────────────────────────────────
//
// Builds an isolated, print-only HTML document and triggers window.print()
// in a hidden iframe. The XPrinter XP-470B picks it up via the OS print
// dialog (auto-fires after registration when printer.autoPrintEnabled).
//
// Layout (proven on the XP-470B driver — flex column with margin-top
// spacing, not gap/space-between, which the driver rasterised inconsistently).

import type { PrinterSettings } from "@/types/settings"

interface BaseLabelData {
  queueNumber:   string   // "001" / "7" — resets per day
  childName:     string
  startDate:     string   // "DD.MM.YYYY"
  startTime:     string   // "HH:mm"
  endTime:       string   // "HH:mm" or "Sınırsız"
  durationLabel: string   // kept for back-compat with callers; not rendered
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
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; }
    .label {
      width: ${w}mm;
      height: ${h}mm;
      padding: 2mm 2.5mm 1.5mm;
      page-break-after: always;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      text-align: center;
      overflow: hidden;
    }
    .label:last-child { page-break-after: auto; }

    .label .queue {
      font-size: 28pt;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    .label .name {
      margin-top: 1.5mm;
      font-size: 20pt;
      font-weight: 900;
      line-height: 0.95;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      word-break: break-word;
    }
    .label .date {
      margin-top: 1.5mm;
      font-size: 11pt;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .label .times {
      margin-top: 1mm;
      font-size: 13pt;
      font-weight: 900;
      line-height: 1.05;
      font-variant-numeric: tabular-nums;
    }
    .label .phone {
      margin-top: auto;
      padding-top: 1mm;
      font-size: 12pt;
      font-weight: 900;
      letter-spacing: 0.03em;
      font-variant-numeric: tabular-nums;
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
    ? `${escapeHtml(data.startTime)} - ${escapeHtml(data.endTime)}`
    : escapeHtml(data.startTime)
  return `
    <div class="label">
      <div class="queue">${escapeHtml(bigQueueDigits(data.queueNumber))}</div>
      <div class="name">${escapeHtml(data.childName)}</div>
      <div class="date">${escapeHtml(data.startDate || "")}</div>
      <div class="times">${timeRange}</div>
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
