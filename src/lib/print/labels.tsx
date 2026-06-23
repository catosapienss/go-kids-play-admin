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
  childName:     string
  startTime:     string   // "HH:mm"
  endTime:       string   // "HH:mm" or "Sınırsız"
  durationLabel: string   // "30 dk", "Serbest", ...
  sessionNumber: string   // public-facing session number / short id
}

export interface ParentLabelData {
  childName:     string
  parentName:    string
  parentPhone:   string
  sessionNumber: string
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
      justify-content: space-between;
      overflow: hidden;
    }
    .label:last-child { page-break-after: auto; }
    .row { display: flex; align-items: baseline; justify-content: space-between; gap: 4mm; }
    .label .name {
      font-size: ${Math.min(w, h) >= 40 ? "7mm" : "5mm"};
      font-weight: 900;
      line-height: 1.05;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      word-break: break-word;
    }
    .label .meta {
      font-size: 3mm;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      opacity: 0.7;
    }
    .label .strong {
      font-size: 4.5mm;
      font-weight: 800;
    }
    .label .session {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 3.5mm;
      font-weight: 900;
      letter-spacing: 0.1em;
      padding: 1mm 2mm;
      border: 0.4mm solid #000;
      border-radius: 1mm;
    }
    .label .row-2 {
      font-size: 4mm;
      font-weight: 700;
    }
    .label .phone {
      font-size: 5mm;
      font-weight: 900;
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

export function renderChildLabel(data: ChildLabelData): string {
  return `
    <div class="label">
      <div class="row">
        <span class="meta">Çocuk</span>
        <span class="session">#${escapeHtml(data.sessionNumber)}</span>
      </div>
      <div class="name">${escapeHtml(data.childName)}</div>
      <div class="row row-2">
        <span>${escapeHtml(data.startTime)} → ${escapeHtml(data.endTime)}</span>
        <span class="strong">${escapeHtml(data.durationLabel)}</span>
      </div>
    </div>
  `
}

export function renderParentLabel(data: ParentLabelData): string {
  return `
    <div class="label">
      <div class="row">
        <span class="meta">Veli</span>
        <span class="session">#${escapeHtml(data.sessionNumber)}</span>
      </div>
      <div class="name">${escapeHtml(data.childName)}</div>
      <div class="row row-2">
        <span class="strong">${escapeHtml(data.parentName || "—")}</span>
      </div>
      <div class="phone">${escapeHtml(data.parentPhone || "—")}</div>
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
