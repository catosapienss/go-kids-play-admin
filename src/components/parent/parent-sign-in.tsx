"use client"

import { useEffect, useRef, useState } from "react"
import { KeyRound, Loader2, AlertCircle, Phone } from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandLogo, BrandAccentStrip } from "@/components/brand-logo"
import { normalizeCode, isPlausibleCode } from "@/lib/services/entry-code.service"
import { ParentPhoneOtp } from "./parent-phone-otp"

// ─── Parent Sign-In Screen ────────────────────────────────────────────────────
//
// Passwordless entry: parent types their PLAY-XXXX code. If the code is valid
// the hook (useParentSession) stores it and the rest of the portal renders.
//
// Designed for thumb operation:
//   • Large 60+ px input with mono digits
//   • Numeric keyboard on mobile (inputMode="text" with autocapitalize="characters")
//   • Brand hero on top (giraffe), code box below, hint copy

interface Props {
  onSubmit: (code: string) => Promise<void>
  error: string | null
}

export function ParentSignIn({ onSubmit, error }: Props) {
  const [raw, setRaw] = useState("")
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [mode, setMode] = useState<"code" | "phone">("code")
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount.
  useEffect(() => { inputRef.current?.focus() }, [])

  const displayValue = raw === "" ? "" : normalizeCode(raw)

  async function submit() {
    if (busy) return
    if (!isPlausibleCode(displayValue)) {
      setLocalError("Kod biçimi: PLAY-1234 · GKP-1234 · KID-1234")
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await onSubmit(displayValue)
    } catch {
      // The hook surfaces the human-readable error via `error` prop.
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void submit()
    }
  }

  const finalError = localError ?? error

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, rgba(124, 58, 237, 0.18), transparent 55%), " +
          "radial-gradient(circle at 90% 100%, rgba(236, 72, 153, 0.12), transparent 50%), " +
          "#0b0b15",
      }}
    >
      {/* Subtle dot texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Brand hero */}
      <div className="flex flex-col items-center mb-10 z-10">
        <BrandLogo variant="hero" size="xl" on="dark" />
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/40 font-semibold mt-4 text-center">
          Veli Portalı
        </p>
      </div>

      {/* Card — switches between code-entry and phone-OTP */}
      {mode === "phone" ? (
        <div className="z-10 w-full max-w-sm">
          <ParentPhoneOtp onBack={() => setMode("code")} simulated />
        </div>
      ) : (
      <div className="w-full max-w-sm relative rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-2xl overflow-hidden z-10">
        <BrandAccentStrip className="opacity-70" />
        <div className="p-6 space-y-5">
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Hoş geldin</h1>
            <p className="text-sm text-white/50 mt-1 leading-relaxed">
              Tesisteki kasiyerden aldığın <strong className="text-white/80 font-semibold">müşteri kodunu</strong> gir.
            </p>
          </div>

          {/* Code input */}
          <div>
            <div className={cn(
              "rounded-2xl border-2 bg-white/[0.04] transition-colors",
              finalError
                ? "border-rose-500/50"
                : "border-white/[0.10] focus-within:border-violet-500/60",
            )}>
              <div className="flex items-center px-4 py-3 gap-3">
                <KeyRound className={cn(
                  "w-4 h-4 flex-shrink-0",
                  finalError ? "text-rose-400" : "text-violet-400",
                )} />
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={busy}
                  value={displayValue}
                  placeholder="PLAY-1234"
                  onChange={(e) => { setRaw(e.target.value); setLocalError(null) }}
                  onKeyDown={onKeyDown}
                  className="flex-1 bg-transparent border-0 outline-none text-xl font-mono font-bold tracking-widest text-white placeholder:text-white/25 placeholder:font-normal placeholder:tracking-normal"
                />
              </div>
            </div>
            {finalError && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-300">
                <AlertCircle className="w-3 h-3" />
                {finalError}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={busy || !displayValue}
            className={cn(
              "w-full min-h-[52px] rounded-2xl font-bold text-base text-white",
              "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500",
              "shadow-lg shadow-violet-500/25 transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2",
            )}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Giriş yapılıyor…
              </>
            ) : (
              "Devam et"
            )}
          </button>

          <p className="text-[11px] text-white/30 text-center leading-relaxed">
            Kodun yoksa tesiste kayıt sonrası kasiyerin sana verdiği koda bak.
          </p>

          {/* Alternate path: phone + OTP (foundation, demo-only today) */}
          <div className="pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setMode("phone")}
              className="w-full flex items-center justify-center gap-2 py-2 text-[11px] uppercase tracking-widest font-bold text-white/40 hover:text-violet-300 transition-colors"
            >
              <Phone className="w-3 h-3" />
              Telefon ile gir
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 normal-case tracking-normal text-[9px] font-semibold">
                yakında
              </span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Footer */}
      <p className="text-[10px] text-white/25 mt-6 z-10">
        <span className="font-semibold">Go Kids Play</span>
        <span className="opacity-50"> · Veli Portalı</span>
      </p>
    </div>
  )
}
