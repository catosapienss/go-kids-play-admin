"use client"

import { useEffect, useState } from "react"
import { Download, X, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── PwaInstallPrompt ────────────────────────────────────────────────────────
//
// Slim bottom banner that surfaces a "Ana ekrana ekle" CTA when the browser
// emits the standard `beforeinstallprompt` event (Chrome / Edge / Samsung Internet).
//
// • Dismissal persists in localStorage so the parent doesn't see it again.
// • iOS Safari doesn't fire the event; we fall back to a one-time hint card
//   the first time the app is opened from iOS Safari (manual share-sheet flow).

const DISMISS_KEY = "gkp:parent:installDismissed"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  if (window.matchMedia("(display-mode: standalone)").matches) return true
  // iOS Safari fallback
  const navAny = navigator as unknown as { standalone?: boolean }
  return !!navAny.standalone
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  const iOS = /iPhone|iPad|iPod/.test(ua)
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return iOS && safari
}

export function PwaInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Initial mount: read dismissal + decide which path applies.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (isStandalone()) { setDismissed(true); return }
    if (window.localStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true); return
    }
    if (isIosSafari()) setShowIosHint(true)
  }, [])

  // Standard Chrome/Edge/Android install event.
  useEffect(() => {
    if (typeof window === "undefined") return
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall)
  }, [])

  function dismiss() {
    try { window.localStorage.setItem(DISMISS_KEY, "1") } catch { /* swallow */ }
    setDismissed(true)
  }

  async function install() {
    if (!event) return
    try {
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
        dismiss()
      }
    } catch { /* swallow */ }
  }

  if (dismissed) return null
  if (!event && !showIosHint) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      className={cn(
        "fixed left-3 right-3 z-30",
        // sit above the bottom nav (~64px + safe area)
        "bottom-[calc(64px+max(env(safe-area-inset-bottom),0.5rem)+0.5rem)]",
        "rounded-2xl border border-violet-200 dark:border-violet-700/60",
        "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl",
        "shadow-2xl shadow-violet-500/20",
        "animate-[slideUp_220ms_ease-out] overflow-hidden",
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Ana ekrana ekle
          </p>
          {event ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Daha hızlı erişim için Go Kids Play&apos;i telefonuna kur.
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Safari&apos;de <span className="font-semibold">Paylaş</span> → <span className="font-semibold">Ana Ekrana Ekle</span> ile uygulamayı kur.
            </p>
          )}
        </div>
        {event && (
          <button
            type="button"
            onClick={install}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-colors"
          >
            <Download className="w-3 h-3" />
            Yükle
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Kapat"
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
