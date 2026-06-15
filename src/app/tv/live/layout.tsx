import type { Metadata } from "next"

// /tv/live is a realtime kiosk display — never prerender it statically,
// useSearchParams + the live session store both require dynamic rendering.
export const dynamic = "force-dynamic"

// ─── /tv/live — minimal fullscreen layout ─────────────────────────────────────
//
// Overrides the root MainLayout chrome. The TV display takes the entire screen
// edge-to-edge, no sidebar, no app header. Designed for kiosk mode operation.

export const metadata: Metadata = {
  title: "Canlı Ekran",
  description: "Go Kids Play live floor display",
  // Tell mobile / tablet browsers to assume the page is fullscreen.
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

export default function TvLiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
