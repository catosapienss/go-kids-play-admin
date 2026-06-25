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

export interface ChildLabelData {
  childName: string
  startTime: string   // "HH:mm"
  endTime:   string   // "HH:mm" or "Sınırsız"
}

export interface ParentLabelData {
  childName:     string
  companyPhone:  string   // shop / company phone — e.g. "+90 532 542 5205"
  durationLabel: string   // "30 Dakika" / "60 Dakika" / "Sınırsız" / ...
  startTime:     string   // "HH:mm"
  endTime:       string   // "HH:mm" or "Sınırsız"
}

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
  // Scale type by the smallest label dimension so 40×60, 60×40, 80×40 all
  // remain legible across the floor.
  const nameSize = Math.min(w, h) >= 40 ? "11mm" : Math.min(w, h) >= 30 ? "9mm" : "7mm"
  const timeSize = Math.min(w, h) >= 40 ? "8mm"  : Math.min(w, h) >= 30 ? "6.5mm" : "5mm"
  return `
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; }
    .label {
      width: ${w}mm;
      height: ${h}mm;
      padding: 2mm 3mm;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 2mm;
      overflow: hidden;
    }
    .label:last-child { page-break-after: auto; }
    .label .name {
      font-size: ${nameSize};
      font-weight: 900;
      line-height: 1.0;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      word-break: break-word;
    }
    .label .times {
      font-size: ${timeSize};
      font-weight: 900;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
    .label .phone {
      font-size: 5mm;
      font-weight: 900;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
    }
    .label .duration {
      font-size: 4.5mm;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
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

// Child label — minimal: child name (huge) over entry → exit times.
//
//   ARDA
//   14:30
//   15:30
export function renderChildLabel(data: ChildLabelData): string {
  return `
    <div class="label">
      <div class="name">${escapeHtml(data.childName)}</div>
      <div class="times">${escapeHtml(data.startTime)}</div>
      <div class="times">${escapeHtml(data.endTime)}</div>
    </div>
  `
}

// Parent label — child name, company phone, duration, entry-exit range.
//
//   ARDA
//   +90 532 542 5205
//   60 Dakika
//   14:30 - 15:30
export function renderParentLabel(data: ParentLabelData): string {
  return `
    <div class="label">
      <div class="name">${escapeHtml(data.childName)}</div>
      <div class="phone">${escapeHtml(data.companyPhone || "—")}</div>
      <div class="duration">${escapeHtml(data.durationLabel)}</div>
      <div class="times">${escapeHtml(data.startTime)} - ${escapeHtml(data.endTime)}</div>
    </div>
  `
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
