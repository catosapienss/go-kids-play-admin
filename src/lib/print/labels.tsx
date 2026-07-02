"use client"

// ─── Thermal Label Renderer ──────────────────────────────────────────────────
//
// Bullet-proof table layout matching the user's printed reference
// (logo · queue · name · date · time · brand · phone). Tables render
// reliably on every print driver including the XP-470B.

import type { PrinterSettings } from "@/types/settings"

interface BaseLabelData {
  queueNumber:   string   // "7" / "001" — resets per day
  childName:     string
  startDate:     string   // "DD.MM.YYYY"
  startTime:     string   // "HH:mm"
  endTime:       string   // "HH:mm" or "Sınırsız"
  durationLabel: string   // accepted for back-compat; not rendered
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

/** Local Turkish format: "0532 542 52 05" — no +90. */
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
    /* Layout matching the target reference (IMG_9068):
       - LEFT column: big queue digit at top, then name / date / time stacked
       - RIGHT column: "GO KIDS PLAY" + phone, rotated vertically
       Table cells are the most reliable primitive across print drivers. */
    @page { size: auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; color: #000; width: 100%; height: 100%; }
    body { font-family: Arial, "Helvetica Neue", sans-serif; }

    table.label {
      width: 100%;
      height: 100vh;
      min-height: ${h}mm;
      min-width:  ${w}mm;
      border-collapse: collapse;
      page-break-after: always;
      table-layout: fixed;
    }
    table.label:last-child { page-break-after: auto; }
    table.label td { padding: 0; overflow: hidden; }

    td.left  {
      width: 78%; padding: 3mm 0 3mm 3mm;
      vertical-align: top; text-align: left;
    }
    td.right {
      width: 22%; padding: 3mm 2mm;
      vertical-align: middle; text-align: center;
      /* Rotate the text vertically so brand + phone read bottom-to-top
         along the right edge — mirrors IMG_9068. */
      writing-mode: vertical-rl;
      text-orientation: mixed;
      white-space: nowrap;
    }

    td.left .queue {
      font-size: 42pt; font-weight: 600; line-height: 1;
      letter-spacing: -0.01em; margin-bottom: 3mm;
    }
    td.left .name {
      font-size: 16pt; font-weight: 600; line-height: 1.05;
      text-transform: uppercase; letter-spacing: 0.01em;
      margin-bottom: 1.5mm;
      white-space: normal; word-break: keep-all; overflow-wrap: normal;
    }
    td.left .date { font-size: 11pt; font-weight: 400; line-height: 1; margin-bottom: 1mm; white-space: nowrap; }
    td.left .time { font-size: 12pt; font-weight: 500; line-height: 1; white-space: nowrap; }

    td.right .brand { font-size: 11pt; font-weight: 700; letter-spacing: 0.08em;
                      text-transform: uppercase; margin-bottom: 3mm; }
    td.right .phone { font-size: 11pt; font-weight: 500; letter-spacing: 0.02em; }

    @media screen {
      body { background: #f1f5f9; padding: 8mm; }
      table.label {
        background: #fff;
        outline: 1px dashed #94a3b8;
        margin: 0 auto 4mm;
      }
    }
  `
}

// ─── HTML builders ───────────────────────────────────────────────────────────

function renderUnifiedLabel(data: BaseLabelData): string {
  const timeRange = data.endTime
    ? `${escapeHtml(data.startTime)}---${escapeHtml(data.endTime)}`
    : escapeHtml(data.startTime)
  const queue = escapeHtml(bigQueueDigits(data.queueNumber))
  const name  = escapeHtml(data.childName || "")
  const date  = escapeHtml(data.startDate || "")
  const phone = escapeHtml(formatLabelPhone(data.companyPhone || ""))
  return `
    <table class="label" cellspacing="0" cellpadding="0">
      <tr>
        <td class="left">
          <div class="queue">${queue}</div>
          <div class="name">${name}</div>
          <div class="date">${date}</div>
          <div class="time">${timeRange}</div>
        </td>
        <td class="right">
          <div class="brand">GO KIDS PLAY</div>
          <div class="phone">${phone}</div>
        </td>
      </tr>
    </table>
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
