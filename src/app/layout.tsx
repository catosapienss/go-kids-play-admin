import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { SessionStoreProvider } from "@/lib/stores/session-store"
import { NotificationStoreProvider } from "@/lib/stores/notification-store"
import { BranchProvider } from "@/lib/branch/branch-context"
import { NetworkStatusProvider } from "@/lib/reliability/network-status"
import { RealtimeSupervisor } from "@/lib/reliability/realtime-supervisor"
import { ErrorBoundary } from "@/components/system/error-boundary"
import { OfflineBanner } from "@/components/system/offline-banner"
import { QuickActionsLauncher } from "@/components/system/quick-actions-launcher"
import { DemoModeProvider } from "@/lib/demo/demo-mode"
import { SettingsProvider } from "@/lib/settings/settings-store"
import { Toaster } from "sonner"
import { PwaInstallPrompt } from "@/components/system/pwa-install-prompt"
// NOTE: Dev tooling (HealthPanel, SystemTestLauncher, DemoControlPanel,
// ActivitySimulator) is *intentionally* left unmounted here. The components
// stay in /src for staging/QA reactivation if needed.

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default:  "Go Kids Play — Yönetim Sistemi",
    template: "%s · Go Kids Play",
  },
  description: "Çocuk oyun alanı operasyon yönetim sistemi.",
  applicationName: "Go Kids Play",
  manifest: "/manifest.webmanifest",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0f172a" },
  ],
  icons: {
    icon: [
      { url: "/brand/favicon.png", type: "image/png", sizes: "any" },
      { url: "/brand/logo.png",    type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/brand/favicon.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Go Kids Play",
  },
  formatDetection: { telephone: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ErrorBoundary>
          <NetworkStatusProvider>
          <RealtimeSupervisor>
          <OfflineBanner />
          <AuthProvider>
            <BranchProvider>
              <SettingsProvider>
              <DemoModeProvider>
              <NotificationStoreProvider>
                <SessionStoreProvider>
                  {children}
                  <QuickActionsLauncher />
                  <PwaInstallPrompt />
                </SessionStoreProvider>
              </NotificationStoreProvider>
              </DemoModeProvider>
              </SettingsProvider>
            </BranchProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                classNames: {
                  toast: "!rounded-2xl !border !shadow-lg !font-medium",
                  success: "!border-emerald-200 dark:!border-emerald-800",
                  error: "!border-rose-200 dark:!border-rose-800",
                  warning: "!border-amber-200 dark:!border-amber-800",
                },
              }}
            />
          </AuthProvider>
          </RealtimeSupervisor>
          </NetworkStatusProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}
