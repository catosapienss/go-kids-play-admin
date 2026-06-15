"use client"

import { useEffect, useState } from "react"
import { QrCode, ScanLine, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { BRAND } from "@/lib/brand"

// ─── ParentQrView — QR Foundation ────────────────────────────────────────────
//
// Visual placeholder for the upcoming QR experience. Today it renders a
// branded "QR coming soon" tile next to the existing PLAY-XXXX code. When the
// QR library is wired in, swap this file's `<QrPattern />` for a real <Qr>
// component (e.g. qrcode.react) — the surrounding container, sizing, and
// touch behaviour are already tuned for the parent portal.
//
// The decorative SVG below renders a stable pseudo-QR that doesn't change on
// re-render (seeded by `code`), so the screen feels like a real QR ready to
// scan. The data is *not* a scannable code — by design — so cashiers don't
// accidentally try to use it during the manual-code era.

interface Props {
  code: string
  className?: string
}

export function ParentQrView({ code, className }: Props) {
  return (
    <div className={cn(
      "rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800",
      "p-5 shadow-xl shadow-slate-900/[0.06] flex items-center gap-5",
      className,
    )}>
      {/* QR tile */}
      <div className="relative w-32 h-32 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 flex-shrink-0">
        <QrPattern seed={code} />

        {/* "Coming soon" lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 dark:bg-slate-900/85 backdrop-blur-[2px] rounded-2xl">
          <Lock className="w-4 h-4 text-violet-500 mb-1" />
          <p className="text-[9px] uppercase tracking-widest font-bold text-violet-600 dark:text-violet-300">
            Yakında
          </p>
        </div>
      </div>

      {/* Right: explainer */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-violet-600 dark:text-violet-300 mb-1">
          <ScanLine className="w-3 h-3" />
          QR Giriş
        </div>
        <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
          QR ile temassız giriş çok yakında.
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          Şimdilik kodunu kasiyere söyle. Sistemde değişiklik gerekmiyor — aynı kod, hem manuel hem QR.
        </p>
      </div>
    </div>
  )
}

// ─── Decorative deterministic pattern ────────────────────────────────────────
//
// Renders a 7×7 grid that looks like a QR symbol. Seeded by the code string
// so each parent sees a stable pattern; cells flip based on a simple hash.

function hash(str: string, i: number): number {
  let h = 5381
  for (let k = 0; k < str.length; k++) {
    h = ((h * 33) ^ str.charCodeAt(k)) >>> 0
  }
  return (h ^ (i * 2654435761)) >>> 0
}

function QrPattern({ seed }: { seed: string }) {
  const SIZE = 7
  const cells: { x: number; y: number; on: boolean; corner: boolean }[] = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Three large finder squares in top-left, top-right, bottom-left
      const corner =
        (x <= 1 && y <= 1) ||
        (x >= SIZE - 2 && y <= 1) ||
        (x <= 1 && y >= SIZE - 2)
      const on = corner || (hash(seed, x * 31 + y) & 1) === 1
      cells.push({ x, y, on, corner })
    }
  }
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x + 0.06}
          y={c.y + 0.06}
          width={0.88}
          height={0.88}
          rx={0.18}
          fill={c.on ? BRAND.primary[900] : "transparent"}
          opacity={c.corner ? 0.9 : 0.65}
        />
      ))}
    </svg>
  )
}

// ─── Compact "scan icon" badge for the home screen ───────────────────────────

export function QrSoonBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-violet-600 dark:text-violet-300 px-2 py-0.5 rounded-full bg-violet-500/10">
      <QrCode className="w-2.5 h-2.5" />
      QR yakında
    </span>
  )
}
