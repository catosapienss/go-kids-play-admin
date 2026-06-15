// ─── Brand Tokens ────────────────────────────────────────────────────────────
//
// Single source of truth for Go Kids Play visual identity. Extracted from the
// official logo (giraffe mascot · "GO KIDS PLAY" wordmark · sky/cloud backdrop).
//
// IMPORTANT: this is an *operational* SaaS — the brand accents below are used
// SPARINGLY (login hero, splash, TV welcome strip, mascot moments). The
// day-to-day admin chrome stays violet/slate so the kasiyer's eye reads the
// data, not the brand.

export const BRAND = {
  // Operational primary (unchanged) — what the dashboard chrome uses.
  primary: {
    50:  "#f5f3ff",
    100: "#ede9fe",
    300: "#c4b5fd",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    900: "#4c1d95",
  },

  // Logo wordmark colours — use only on brand moments (login, splash, TV).
  // These come straight from the giraffe logo.
  mark: {
    /** "GO" — fresh playful green */
    green:  "#67c97a",
    /** "KIDS" — bright kid-friendly pink */
    pink:   "#ec5e9c",
    /** "PLAY" — warm sunshine yellow (same family as the giraffe) */
    yellow: "#fdc841",
    /** Sky background tone */
    sky:    "#9bdfff",
    /** Mascot fur (soft caramel/yellow) */
    caramel: "#f4be63",
  },

  /** App icon-friendly background — gradient used by the favicon mark. */
  iconBg: "linear-gradient(135deg, #c7eafc 0%, #9bdfff 60%, #67c97a 100%)",
} as const

// Convenience: the four hero gradient colors that map to the wordmark letters,
// in order (GO=green, K=pink, I=violet, D=sky, S=yellow → simplified to 3).
export const WORDMARK_GRADIENT = [
  BRAND.mark.green,
  BRAND.mark.pink,
  BRAND.mark.yellow,
] as const

// File-system contract — drop these assets into `public/brand/` to activate
// the real logo across the system. Without them the app falls back to the
// gradient + Baby-icon mark, so nothing breaks if the file is missing.
export const BRAND_ASSETS = {
  /** Full logo with giraffe + wordmark (used on login, splash, TV welcome). */
  full:   "/brand/logo.png",
  /** Stamp / icon-only variant for tight spaces (sidebar collapsed, favicon source). */
  mark:   "/brand/logo-mark.png",
  /** Optional dark-background variant. */
  fullDark: "/brand/logo-dark.png",
} as const
