"use client"

import { useEffect, useRef, useState } from "react"
import { Phone, ChevronLeft, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Phone + OTP Foundation (alternate sign-in path) ─────────────────────────
//
// Today the parent signs in with a PLAY-XXXX code. This component sketches
// the *alternate* path — phone number + 6-digit OTP — so the UI is ready the
// moment a real SMS provider is wired in.
//
// Current behaviour (foundation only):
//   • Step 1 — parent enters their phone number; we call `onRequestOtp`.
//     The parent shell's auth hook should send an SMS (Twilio etc) and resolve.
//   • Step 2 — parent enters the 6-digit code; we call `onVerify(otp)`.
//     The auth hook returns the parent bundle just like signInWithCode does.
//
// Until the SMS adapter exists, callers should pass `simulated={true}`. The
// component then bypasses the network and accepts the *static* dev OTP
// (`123456`) so QA can demo the full flow.

interface Props {
  /** Called when the parent confirms their phone number. */
  onRequestOtp?: (phone: string) => Promise<void>
  /** Called with the 6-digit OTP after entry. */
  onVerify?: (phone: string, otp: string) => Promise<void>
  /** Demo mode — accept `123456` locally without provider. */
  simulated?: boolean
  /** Switch back to code-entry mode. */
  onBack: () => void
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`
  if (d.length <= 9) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`
}
function digitsOnly(raw: string): string { return raw.replace(/\D/g, "") }

export function ParentPhoneOtp({
  onRequestOtp,
  onVerify,
  simulated = true,
  onBack,
}: Props) {
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const otpRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === "otp") otpRef.current?.focus()
  }, [step])

  async function requestOtp() {
    const d = digitsOnly(phone)
    if (d.length !== 11) {
      setError("Telefon numarası 11 haneli olmalı.")
      return
    }
    setBusy(true); setError(null)
    try {
      if (simulated) {
        // Pretend an SMS was sent.
        await new Promise((r) => setTimeout(r, 600))
      } else {
        await onRequestOtp?.(d)
      }
      setStep("otp")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kod gönderilemedi")
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    if (otp.length !== 6) {
      setError("6 haneli kodu gir.")
      return
    }
    setBusy(true); setError(null)
    try {
      if (simulated) {
        if (otp !== "123456") throw new Error("Demo kodu yanlış (123456 dene).")
        // Demo: nothing to call — just go back to the main shell.
        await new Promise((r) => setTimeout(r, 400))
      } else {
        await onVerify?.(digitsOnly(phone), otp)
      }
      // On real provider success the parent-session hook would take over.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Doğrulama başarısız")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-sm relative rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-2xl overflow-hidden">
      <div className="p-6 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold text-white/40 hover:text-white/70"
        >
          <ChevronLeft className="w-3 h-3" /> Kod ile girişe dön
        </button>

        {step === "phone" ? (
          <>
            <div>
              <h2 className="text-lg font-bold text-white">Telefonunla gir</h2>
              <p className="text-sm text-white/50 mt-1 leading-relaxed">
                Sana SMS ile 6 haneli doğrulama kodu göndereceğiz.
                {simulated && <span className="block text-[10px] text-amber-300/70 mt-1">Demo: SMS gerçekten gitmiyor.</span>}
              </p>
            </div>

            <div className={cn(
              "rounded-2xl border-2 bg-white/[0.04] transition-colors",
              error ? "border-rose-500/50" : "border-white/[0.10] focus-within:border-violet-500/60",
            )}>
              <div className="flex items-center gap-3 px-4 py-3">
                <Phone className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  disabled={busy}
                  placeholder="0532 000 00 00"
                  value={formatPhone(phone)}
                  onChange={(e) => { setPhone(e.target.value); setError(null) }}
                  className="flex-1 bg-transparent border-0 outline-none text-base font-mono tracking-wider text-white placeholder:text-white/25"
                />
              </div>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-rose-300">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={requestOtp}
              disabled={busy || digitsOnly(phone).length === 0}
              className="w-full min-h-[52px] rounded-2xl font-bold text-base text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Kod gönderiliyor…</> : "Kod gönder"}
            </button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-bold text-white">SMS Kodu</h2>
              <p className="text-sm text-white/50 mt-1 leading-relaxed">
                {formatPhone(phone)} numarasına gönderdiğimiz 6 haneli kodu gir.
                {simulated && <span className="block text-[10px] text-amber-300/70 mt-1">Demo kodu: <span className="font-mono">123456</span></span>}
              </p>
            </div>

            <div className={cn(
              "rounded-2xl border-2 bg-white/[0.04] transition-colors",
              error ? "border-rose-500/50" : "border-white/[0.10] focus-within:border-violet-500/60",
            )}>
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={busy}
                placeholder="••••••"
                value={otp.replace(/\D/g, "")}
                onChange={(e) => { setOtp(e.target.value); setError(null) }}
                className="w-full bg-transparent border-0 outline-none text-center text-3xl font-mono font-bold tracking-[0.5em] text-white py-4 placeholder:text-white/25"
              />
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-rose-300">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={verify}
              disabled={busy || otp.length !== 6}
              className="w-full min-h-[52px] rounded-2xl font-bold text-base text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Doğrulanıyor…</> : "Doğrula ve gir"}
            </button>

            <button
              type="button"
              onClick={() => setStep("phone")}
              className="w-full text-[11px] uppercase tracking-widest font-bold text-white/40 hover:text-white/70 py-1"
            >
              Numarayı değiştir
            </button>
          </>
        )}
      </div>
    </div>
  )
}
