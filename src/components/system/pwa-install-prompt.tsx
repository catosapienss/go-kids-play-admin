"use client"

import { useEffect, useState } from "react"
import { Download, X, Monitor } from "lucide-react"
import { useServiceWorker } from "@/hooks/use-service-worker"

// ─── PWA Install Prompt ───────────────────────────────────────────────────────
//
// Shows a banner when Chrome's beforeinstallprompt fires (Windows/Mac Chrome).
// Dismissed state persists in localStorage so it doesn't re-appear every visit.

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PwaInstallPrompt() {
  useServiceWorker("/sw.js")
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already installed or dismissed? Don't show.
    if (window.matchMedia("(display-mode: standalone)").matches) return
    if (localStorage.getItem("gkp:pwa-install-dismissed") === "1") return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setVisible(false)
    localStorage.setItem("gkp:pwa-install-dismissed", "1")
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-white dark:bg-slate-900 shadow-xl shadow-violet-500/10 p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center flex-shrink-0">
        <Monitor className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Masaüstüne Yükle</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Go Kids Play'i masaüstü uygulaması olarak yükleyin — daha hızlı erişim.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Yükle
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
          >
            Sonra
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
      >
        <X className="w-3.5 h-3.5 text-slate-400" />
      </button>
    </div>
  )
}
