import type { Metadata, Viewport } from "next"

// ─── /parent — minimal mobile chrome ──────────────────────────────────────────
//
// The parent portal opts out of the admin MainLayout (no sidebar, no header).
// Behaves like a standalone mobile app — full-bleed, viewport-locked.

export const metadata: Metadata = {
  title: "Go Kids Play",
  description: "Veli portalı — aktif süre, cüzdan ve giriş kodu",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Go Kids Play",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0b0b15" },
  ],
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
