"use client"

// ─── Thermal Label Renderer ──────────────────────────────────────────────────
//
// Builds an isolated, print-only HTML document and triggers window.print()
// in a hidden iframe. Operator picks the XPrinter XP-470B from the browser's
// print dialog (no USB / driver work — yet).
//
// Two label shapes:
//
//   • Child label:  child name (huge) · start–end time · duration · session #
//   • Parent label: child name · parent name · phone · session #
//
// Both labels share a high-contrast monochrome layout sized from PrinterSettings
// (labelWidthMm × labelHeightMm) so they fit a 40×60mm / 80×40mm thermal roll.

import type { PrinterSettings } from "@/types/settings"

// Unified label shape: child + parent labels carry the same data so the
// printout looks identical regardless of which button fires. Keeping the two
// separate exports preserves backwards-compatibility with existing call sites
// (PrintButtons, ReprintLabelsButton) — they just construct the same fields.

interface BaseLabelData {
  childName:     string
  startTime:     string   // "HH:mm"
  endTime:       string   // "HH:mm" or "Sınırsız"
  durationLabel: string   // "30 DK" / "60 DK" / "SINIRSIZ" / ...
  companyPhone:  string   // shop / company phone — e.g. "+90 532 542 5205"
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

    /* Logo — upper-left small mark, reserved column does NOT shrink body */
    .label .logo {
      position: absolute;
      top: 1.5mm;
      left: 2mm;
      width: 9mm;
      height: 9mm;
      object-fit: contain;
    }

    /* Brand strip — small top header so labels are recognisable at a glance */
    .label .brand {
      width: 100%;
      font-size: 8pt;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: right;
      line-height: 1;
    }

    .label .name {
      margin-top: 1.5mm;
      font-size: 26pt;          /* spec: 24–28pt */
      font-weight: 900;
      line-height: 0.95;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      word-break: break-word;
    }
    .label .times {
      margin-top: 1.5mm;
      font-size: 19pt;          /* spec: 18–20pt */
      font-weight: 900;
      line-height: 1.05;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
    .label .duration {
      margin-top: 1mm;
      font-size: 15pt;          /* spec: 14–16pt */
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .label .phone {
      margin-top: auto;          /* pin phone to the bottom of the label */
      padding-top: 1mm;
      font-size: 13pt;          /* spec: 12–14pt */
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

// Unified label layout used by BOTH the child and parent prints. Same data,
// same dimensions, same typography — printing identical sticker pairs is
// faster on the floor than asking the operator to remember which copy goes
// where during busy hours.
//
//   [logo]            GO KIDS PLAY
//
//                  ARDA
//
//             14:43 - 15:43
//                  60 DK
//
//             +90 532 542 5205
function renderUnifiedLabel(data: BaseLabelData): string {
  const timeRange = data.endTime
    ? `${escapeHtml(data.startTime)} - ${escapeHtml(data.endTime)}`
    : escapeHtml(data.startTime)
  return `
    <div class="label">
      <img class="logo" src="/brand/logo-mark.png" alt="" onerror="this.style.display='none'">
      <div class="brand">GO KIDS PLAY</div>
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

/**
 * Open a hidden iframe with the given labels and call print() inside it.
 * The browser's native print dialog appears; operator selects the XP-470B.
 * Returns a promise that resolves once the iframe is removed.
 */
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
      try {
        w.focus()
        w.print()
      } catch {
        // Some browsers throw if the iframe was already torn down
      }
      // Most browsers fire afterprint reliably; fall back to a timer.
      w.addEventListener?.("afterprint", finish, { once: true })
      setTimeout(finish, 5000)
    }

    document.body.appendChild(iframe)
  })
}
