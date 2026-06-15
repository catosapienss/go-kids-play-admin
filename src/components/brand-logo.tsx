"use client"

import { useState } from "react"
import { Baby } from "lucide-react"
import { cn } from "@/lib/utils"
import { BRAND, BRAND_ASSETS, WORDMARK_GRADIENT } from "@/lib/brand"

// ─── BrandLogo ────────────────────────────────────────────────────────────────
//
// Single component for every brand surface across the app.
//
// Loading model:
//   1. Tries to load `/brand/logo.png` (drop the official PNG there to activate).
//   2. If the request 404s or errors, falls back to a tasteful gradient stamp
//      with a Baby icon — the layout stays intact, just less branded.
//   3. The wordmark text ("Go Kids Play") is *always* rendered in CSS, so even
//      icon-less fallback states preserve brand recognition.
//
// Variants:
//   • mark     — icon-only square (sidebar collapsed, favicon source, mobile bottom-nav)
//   • wordmark — text-only (footer, watermarks, dense headers)
//   • full     — mark + wordmark side-by-side (default)
//   • stacked  — mark on top, wordmark below (login, splash)
//   • hero     — large decorative variant with glow (login hero)

type BrandSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"

interface BrandLogoProps {
  variant?: "mark" | "wordmark" | "full" | "stacked" | "hero"
  size?: BrandSize
  on?: "light" | "dark" | "auto"
  showSubtitle?: boolean
  className?: string

  // ── Backward-compat aliases (kept so existing call sites still work) ────
  /** @deprecated Use `variant` instead. */
  iconOnly?: boolean
  /** @deprecated Use `variant="stacked"` instead. */
  stacked?: boolean
}

const SIZE_CFG: Record<BrandSize, {
  box: string
  fallbackIcon: string
  title: string
  sub: string
  gap: string
}> = {
  xs:    { box: "w-6 h-6 rounded-md",     fallbackIcon: "w-3 h-3",   title: "text-xs",   sub: "text-[9px]",  gap: "gap-1.5" },
  sm:    { box: "w-8 h-8 rounded-lg",     fallbackIcon: "w-4 h-4",   title: "text-sm",   sub: "text-[10px]", gap: "gap-2" },
  md:    { box: "w-10 h-10 rounded-xl",   fallbackIcon: "w-5 h-5",   title: "text-base", sub: "text-xs",     gap: "gap-2.5" },
  lg:    { box: "w-12 h-12 rounded-xl",   fallbackIcon: "w-6 h-6",   title: "text-lg",   sub: "text-xs",     gap: "gap-3" },
  xl:    { box: "w-16 h-16 rounded-2xl",  fallbackIcon: "w-8 h-8",   title: "text-2xl",  sub: "text-sm",     gap: "gap-3.5" },
  "2xl": { box: "w-24 h-24 rounded-3xl",  fallbackIcon: "w-12 h-12", title: "text-3xl",  sub: "text-base",   gap: "gap-4" },
}

// ─── Public component ────────────────────────────────────────────────────────

export function BrandLogo({
  variant,
  size = "md",
  on = "auto",
  showSubtitle,
  className,
  iconOnly,
  stacked,
}: BrandLogoProps) {
  // Resolve legacy props.
  const resolvedVariant: NonNullable<BrandLogoProps["variant"]> =
    variant ?? (iconOnly ? "mark" : stacked ? "stacked" : "full")

  const cfg = SIZE_CFG[size]
  const showSub = showSubtitle ?? resolvedVariant !== "mark"
  const isStacked = resolvedVariant === "stacked" || resolvedVariant === "hero"
  const isHero = resolvedVariant === "hero"

  return (
    <div
      className={cn(
        "inline-flex select-none",
        isStacked ? `flex-col items-center ${cfg.gap}` : `items-center ${cfg.gap}`,
        className,
      )}
    >
      {resolvedVariant !== "wordmark" && (
        <BrandMark size={size} hero={isHero} />
      )}
      {resolvedVariant !== "mark" && (
        <BrandWordmark
          titleClass={cfg.title}
          subClass={cfg.sub}
          showSubtitle={showSub}
          align={isStacked ? "center" : "left"}
          on={on}
        />
      )}
    </div>
  )
}

// ─── Mark (icon square) ──────────────────────────────────────────────────────

interface BrandMarkProps {
  size?: BrandSize
  hero?: boolean
  className?: string
}

export function BrandMark({ size = "md", hero = false, className }: BrandMarkProps) {
  const cfg = SIZE_CFG[size]
  const [imageOk, setImageOk] = useState(true)

  return (
    <div className={cn("relative flex-shrink-0", className)}>
      <div
        className={cn(
          cfg.box,
          "flex items-center justify-center overflow-hidden",
          // Soft sky-tinted backdrop while the real image is loading / present.
          // Falls back to the operational violet gradient when the image fails.
          imageOk
            ? "bg-gradient-to-br from-sky-100 via-sky-200/70 to-emerald-100/80 dark:from-sky-300/90 dark:via-sky-200/80 dark:to-emerald-200/80"
            : "bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30",
          hero && "ring-4 ring-white/40 dark:ring-white/10 shadow-2xl shadow-sky-500/20",
        )}
      >
        {imageOk ? (
          /* Real logo. Plain <img> so missing files trigger onError → fallback. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={BRAND_ASSETS.full}
            alt="Go Kids Play"
            draggable={false}
            onError={() => setImageOk(false)}
            className="w-full h-full object-contain"
          />
        ) : (
          <Baby className={cn(cfg.fallbackIcon, "text-white")} />
        )}
      </div>

      {hero && (
        /* Soft brand-coloured glow behind the hero mark — playful but quiet. */
        <div
          aria-hidden
          className="absolute -inset-3 -z-10 rounded-[inherit] blur-2xl opacity-60"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${BRAND.mark.green}55, transparent 60%), radial-gradient(circle at 70% 70%, ${BRAND.mark.pink}44, transparent 60%)`,
          }}
        />
      )}
    </div>
  )
}

// ─── Wordmark (typographic) ──────────────────────────────────────────────────

interface BrandWordmarkProps {
  titleClass: string
  subClass: string
  showSubtitle: boolean
  align: "left" | "center"
  on: "light" | "dark" | "auto"
}

function BrandWordmark({ titleClass, subClass, showSubtitle, align, on }: BrandWordmarkProps) {
  // "Go" green · "Kids" pink · "Play" yellow — straight from the logo.
  return (
    <div className={cn(align === "center" && "text-center")}>
      <p className={cn(titleClass, "font-black leading-none tracking-tight")}>
        <span style={{ color: BRAND.mark.green  }}>Go</span>
        <span style={{ color: BRAND.mark.pink   }} className="mx-0.5">Kids</span>
        <span style={{ color: BRAND.mark.yellow }}>Play</span>
      </p>
      {showSubtitle && (
        <p className={cn(
          subClass,
          "font-semibold mt-1 tracking-wider uppercase",
          on === "dark"  && "text-white/50",
          on === "light" && "text-slate-500",
          on === "auto"  && "text-slate-500 dark:text-white/45",
        )}>
          Yönetim Sistemi
        </p>
      )}
    </div>
  )
}

// ─── Decorative accent strip ─────────────────────────────────────────────────
//
// A 3-band horizontal strip echoing the wordmark colours. Use as a top-border
// on branded surfaces (login card, TV header, splash). Defaults to 1px tall
// so it never competes with content.

export function BrandAccentStrip({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("h-px w-full flex", className)}>
      {WORDMARK_GRADIENT.map((c) => (
        <div key={c} className="flex-1" style={{ background: c }} />
      ))}
    </div>
  )
}
