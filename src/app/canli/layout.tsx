import type { Metadata } from "next"

// ─── /canli — fullscreen layout (no admin chrome) ─────────────────────────────
//
// The Live Play Area is a kiosk/family-facing surface — no sidebar, no header,
// edge-to-edge. Layout mirrors /tv/live's opt-out pattern.

export const metadata: Metadata = {
  title: "Canlı Oyun Alanı",
  description: "Çocuklarınızın anlık oyun süresi takibi",
}

export default function CanliLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
