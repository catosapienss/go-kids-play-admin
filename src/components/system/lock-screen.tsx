"use client"

import { useEffect, useState } from "react"
import { Lock, Delete, AlertCircle, LogOut } from "lucide-react"
import { useSessionLock } from "@/contexts/session-lock-context"
import { useAuth } from "@/contexts/auth-context"
import { fromAuthEmail } from "@/lib/auth/username"
import { BrandLogo, BrandAccentStrip } from "@/components/brand-logo"
import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

// ─── Lock Screen Overlay ──────────────────────────────────────────────────────
//
// Full-screen modal that appears whenever the session-lock context flags the
// session as idle. Numeric pad → verify_pin RPC → on success the overlay
// disappears and the user lands on the exact same page they left.

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Süper Admin",
  admin:       "Yönetici",
  manager:     "Müdür",
  staff:       "Personel",
  cashier:     "Kasiyer",
}

const MAX_ATTEMPTS = 5

export function LockScreen() {
  const { locked, verifyPin } = useSessionLock()
  const { user, signOut } = useAuth()
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [shake, setShake] = useState(false)

  // Reset state every time the lock turns on.
  useEffect(() => {
    if (locked) {
      setPin("")
      setError(null)
      setAttempts(0)
    }
  }, [locked])

  // Auto-submit when 4 digits are entered.
  useEffect(() => {
    if (pin.length !== 4 || busy || !locked) return
    void submit(pin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  async function submit(value: string) {
    setBusy(true)
    setError(null)
    const ok = await verifyPin(value)
    setBusy(false)
    if (!ok) {
      const next = attempts + 1
      setAttempts(next)
      setShake(true)
      setTimeout(() => setShake(false), 400)
      setPin("")
      if (next >= MAX_ATTEMPTS) {
        setError(`Çok fazla hatalı deneme. Oturum kapatılıyor…`)
        setTimeout(() => { void signOut() }, 1200)
      } else {
        setError(`Hatalı PIN. ${MAX_ATTEMPTS - next} deneme kaldı.`)
      }
    }
  }

  function press(digit: string) {
    if (busy || pin.length >= 4) return
    setPin((p) => p + digit)
    setError(null)
  }

  function backspace() {
    if (busy) return
    setPin((p) => p.slice(0, -1))
    setError(null)
  }

  // Keyboard support — 0-9 + backspace.
  useEffect(() => {
    if (!locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") press(e.key)
      else if (e.key === "Backspace") backspace()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, pin, busy])

  if (!locked || !user) return null

  const displayName = user.fullName || fromAuthEmail(user.email) || "Kullanıcı"
  const roleLabel = ROLE_LABEL[user.role] ?? user.role

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Oturum kilidi"
      className="fixed inset-0 z-[9999] flex items-center justify-center px-6 py-10 overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, rgba(124,58,237,0.18), transparent 55%), " +
          "radial-gradient(circle at 90% 100%, rgba(236,72,153,0.12), transparent 50%), " +
          "#0b0b15",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Dot texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div
        className={cn(
          "relative w-full max-w-sm rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-2xl overflow-hidden z-10 transition-transform",
          shake && "animate-[lockShake_400ms_ease-in-out]",
        )}
      >
        <BrandAccentStrip className="opacity-70" />

        <div className="p-7 space-y-6">
          {/* Brand */}
          <div className="flex flex-col items-center">
            <BrandLogo variant="hero" size="lg" on="dark" />
          </div>

          {/* User identity */}
          <div className="text-center space-y-1.5">
            <div className="flex items-center justify-center gap-2 text-white/40">
              <Lock className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-[0.3em] font-semibold">
                Oturum Kilitli
              </span>
            </div>
            <h1 className="text-xl font-bold text-white">{displayName}</h1>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-white/50">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: BRAND.mark.green }}
              />
              {roleLabel}
            </p>
          </div>

          {/* PIN dots */}
          <div className="flex items-center justify-center gap-3 py-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-3.5 h-3.5 rounded-full border-2 transition-all",
                  pin.length > i
                    ? "bg-violet-400 border-violet-400 scale-110"
                    : "border-white/30",
                )}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-xs text-rose-300">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* Numeric pad */}
          <div className="grid grid-cols-3 gap-2.5">
            {["1","2","3","4","5","6","7","8","9"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => press(d)}
                disabled={busy}
                className="aspect-square rounded-2xl bg-white/[0.04] hover:bg-white/[0.10] active:bg-white/[0.15] border border-white/[0.08] text-2xl font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {d}
              </button>
            ))}
            <div />
            <button
              type="button"
              onClick={() => press("0")}
              disabled={busy}
              className="aspect-square rounded-2xl bg-white/[0.04] hover:bg-white/[0.10] active:bg-white/[0.15] border border-white/[0.08] text-2xl font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              0
            </button>
            <button
              type="button"
              onClick={backspace}
              disabled={busy || pin.length === 0}
              className="aspect-square rounded-2xl bg-white/[0.04] hover:bg-white/[0.10] active:bg-white/[0.15] border border-white/[0.08] text-white/70 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Sil"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Sign-out escape hatch */}
          <button
            type="button"
            onClick={() => { void signOut() }}
            className="w-full flex items-center justify-center gap-2 py-2 text-[11px] uppercase tracking-widest font-bold text-white/40 hover:text-rose-300 transition-colors border-t border-white/[0.06] pt-4"
          >
            <LogOut className="w-3 h-3" />
            Farklı kullanıcı ile gir
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes lockShake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-8px); }
          50%      { transform: translateX(8px); }
          75%      { transform: translateX(-4px); }
        }
      `}</style>
    </div>
  )
}
