// ─── Subtle UI feedback sounds (Web Audio, no assets) ─────────────────────────
//
// Tiny synthesised tones for operational feedback. Used by the alert engine
// and direct UI flows (POS, QR success). No external mp3/wav files.

import type { NotificationSeverity } from "@/types/notifications"

type CtxRef = { ctx: AudioContext | null }
const _ref: CtxRef = { ctx: null }

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (_ref.ctx) return _ref.ctx
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const Ctor = W.AudioContext ?? W.webkitAudioContext
    if (!Ctor) return null
    _ref.ctx = new Ctor()
    return _ref.ctx
  } catch {
    return null
  }
}

function playTone(opts: { freq: number; duration: number; type?: OscillatorType; volume?: number; pitchEnd?: number }) {
  const ctx = getCtx()
  if (!ctx) return
  const { freq, duration, type = "sine", volume = 0.07, pitchEnd } = opts

  // Most browsers require a user gesture before audio starts. If suspended,
  // attempt resume but silently fail — we never want sounds blocking the UI.
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined)
  }

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  if (pitchEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(pitchEnd, ctx.currentTime + duration)
  }

  // Gentle envelope — no clicks.
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)

  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration + 0.02)
}

// ─── Sound vocabulary ─────────────────────────────────────────────────────────

const SoundLib = {
  success() {
    playTone({ freq: 660,  duration: 0.10, type: "sine",     volume: 0.08 })
    setTimeout(() => playTone({ freq: 990, duration: 0.13, type: "sine", volume: 0.08 }), 80)
  },
  info() {
    playTone({ freq: 520,  duration: 0.12, type: "sine",     volume: 0.05 })
  },
  warning() {
    playTone({ freq: 440,  duration: 0.18, type: "triangle", volume: 0.07, pitchEnd: 360 })
  },
  critical() {
    playTone({ freq: 380,  duration: 0.18, type: "square",   volume: 0.06 })
    setTimeout(() => playTone({ freq: 380, duration: 0.18, type: "square", volume: 0.06 }), 200)
  },
  qrSuccess() {
    playTone({ freq: 880,  duration: 0.08, type: "sine",     volume: 0.08, pitchEnd: 1320 })
  },
  error() {
    playTone({ freq: 220,  duration: 0.25, type: "sawtooth", volume: 0.05 })
  },
}

export type SoundName = keyof typeof SoundLib

/** Play a named sound. Safe to call from anywhere; no-op when audio is unavailable. */
export function playSound(name: SoundName): void {
  try { SoundLib[name]?.() } catch { /* swallow */ }
}

/** Map a notification severity to its default sound. */
export function severityToSound(severity: NotificationSeverity): SoundName {
  switch (severity) {
    case "success":  return "success"
    case "warning":  return "warning"
    case "critical": return "critical"
    default:         return "info"
  }
}

// ─── Mute preference (persisted in localStorage) ──────────────────────────────

const MUTE_KEY = "gkp:notifications:muted"

export function isMuted(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(MUTE_KEY) === "1"
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return
  if (muted) window.localStorage.setItem(MUTE_KEY, "1")
  else window.localStorage.removeItem(MUTE_KEY)
  // Inform the rest of the app
  window.dispatchEvent(new CustomEvent("gkp:mute-changed", { detail: muted }))
}
