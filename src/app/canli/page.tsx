"use client"

import { useEffect, useState } from "react"
import {
  Video, Sparkles, Clock, Baby, ShieldCheck, Wifi, Maximize2,
  ChevronLeft,
} from "lucide-react"
import Link from "next/link"
import { useSessionStore } from "@/lib/stores/session-store"
import { formatTime, getStatus, type ActiveSession } from "@/types/aktif-oyun"
import { cn } from "@/lib/utils"
import { BrandMark } from "@/components/brand-logo"
import { BRAND } from "@/lib/brand"

// ─── /canli — Live Play Area ──────────────────────────────────────────────────
//
// Future-ready family-facing screen. Today it's a premium "live status panel"
// with a large camera placeholder on the left and the parent's active session
// info on the right. The camera area is intentionally a hint about what's
// coming — no real video stream yet.
//
// Layout principles:
//   • Family-friendly, calm, trustworthy
//   • Large readable type (parent might watch from a distance)
//   • Single child focus (auto-picks the most-active session)
//   • Soft animations, no business-y dashboard chrome

export default function CanliPage() {
  const { sessions } = useSessionStore()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) & 0xffff), 1000)
    return () => clearInterval(id)
  }, [])
  void tick

  // Pick the most-relevant session to focus on:
  //   1. Non-paused, time-remaining > 0
  //   2. Otherwise the most recent insertion
  const focus: ActiveSession | undefined = sessions
    .filter((s) => !s.isPaused && (s.totalMinutes === 0 || s.remainingSeconds > 0))
    .sort((a, b) => a.remainingSeconds - b.remainingSeconds)[0]
    ?? sessions[0]

  return (
    <main
      className="min-h-screen w-full text-white relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 30% 0%, rgba(124, 58, 237, 0.22), transparent 55%), " +
          "radial-gradient(circle at 80% 100%, rgba(236, 72, 153, 0.14), transparent 50%), " +
          "#0a0a14",
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

      {/* Top brand strip */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <BrandMark size="lg" />
          <div className="hidden sm:block">
            <p className="text-xl font-black leading-none tracking-tight">
              <span style={{ color: BRAND.mark.green }}>Go</span>
              <span style={{ color: BRAND.mark.pink   }} className="mx-0.5">Kids</span>
              <span style={{ color: BRAND.mark.yellow }}>Play</span>
            </p>
            <p className="text-[11px] uppercase tracking-widest text-white/40 font-semibold mt-1">
              Canlı Oyun Alanı
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="hidden md:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
          Yönetici paneline dön
        </Link>
      </header>

      {/* Two-column main */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 px-6 lg:px-10 py-6 lg:py-8">
        {/* LEFT: Camera placeholder */}
        <CameraPlaceholder />

        {/* RIGHT: Session info */}
        <SessionPanel session={focus} />
      </div>

      {/* Bottom trust strip */}
      <footer className="relative z-10 px-8 py-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/40">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" />
          <span className="font-semibold">Güvenli oyun alanı · canlı takip</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span>Realtime senkronize</span>
        </div>
      </footer>
    </main>
  )
}

// ─── Camera placeholder ──────────────────────────────────────────────────────

function CameraPlaceholder() {
  return (
    <section className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-white/[0.02] aspect-video lg:aspect-auto lg:min-h-[480px] flex items-center justify-center">
      {/* Faint signal grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Corner brackets — camera viewport feel */}
      {([
        "top-6 left-6 border-t-2 border-l-2",
        "top-6 right-6 border-t-2 border-r-2",
        "bottom-6 left-6 border-b-2 border-l-2",
        "bottom-6 right-6 border-b-2 border-r-2",
      ]).map((pos) => (
        <div
          key={pos}
          className={cn("absolute w-8 h-8 border-violet-400/40 rounded-md", pos)}
          aria-hidden
        />
      ))}

      {/* Live indicator (top-left, inside the frame) */}
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <span className="relative flex w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-rose-500/60 animate-ping" />
          <span className="relative rounded-full bg-rose-500 w-2 h-2" />
        </span>
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-rose-200">
          Yakında canlı
        </span>
      </div>

      {/* Central icon + message */}
      <div className="relative text-center px-6 max-w-md">
        <div
          className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(236,72,153,0.18))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Video className="w-9 h-9 text-violet-200" />
        </div>
        <p className="text-lg font-bold text-white/85">
          Canlı kamera bağlantısı yakında
        </p>
        <p className="text-sm text-white/45 mt-2 leading-relaxed">
          Ailelerin çocuklarını oyun alanında anlık olarak izleyebileceği
          güvenli kamera yayını çok yakında bu ekranda olacak.
        </p>

        <div className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
          <Sparkles className="w-3 h-3 text-fuchsia-300" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/60">
            Yapım aşamasında
          </span>
        </div>
      </div>

      {/* Maximize hint (top-right) */}
      <button
        type="button"
        onClick={() => {
          if (typeof document !== "undefined") {
            void document.documentElement.requestFullscreen?.().catch(() => undefined)
          }
        }}
        aria-label="Tam ekran"
        className="absolute top-8 right-8 w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </section>
  )
}

// ─── Session info panel ──────────────────────────────────────────────────────

function SessionPanel({ session }: { session?: ActiveSession }) {
  if (!session) {
    return (
      <aside className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 flex flex-col items-center justify-center text-center">
        <Baby className="w-10 h-10 text-white/20 mb-3" />
        <p className="text-base font-bold text-white/70">Şu an oyunda çocuk yok</p>
        <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
          Yeni bir giriş yapıldığında bu ekran<br />otomatik olarak güncellenecek.
        </p>
      </aside>
    )
  }

  const status = getStatus(session)
  const isUnlimited = session.totalMinutes === 0
  const isCritical = status === "expiring" && session.remainingSeconds <= 5 * 60
  const isWarning  = status === "expiring" && !isCritical

  const tone = isCritical
    ? { ring: "border-rose-500/60",   timeFg: "text-rose-300",   accent: "from-rose-500/15 to-rose-500/5",   chip: "bg-rose-500/20 text-rose-100" }
    : isWarning
    ? { ring: "border-amber-500/50",  timeFg: "text-amber-300",  accent: "from-amber-500/15 to-amber-500/5", chip: "bg-amber-500/20 text-amber-100" }
    : isUnlimited
    ? { ring: "border-fuchsia-500/40", timeFg: "text-fuchsia-300", accent: "from-fuchsia-500/15 to-purple-500/8", chip: "bg-fuchsia-500/20 text-fuchsia-100" }
    : { ring: "border-emerald-500/40", timeFg: "text-emerald-300", accent: "from-emerald-500/12 to-emerald-500/4", chip: "bg-emerald-500/15 text-emerald-100" }

  return (
    <aside className={cn(
      "rounded-3xl border-2 overflow-hidden flex flex-col",
      tone.ring,
      "bg-gradient-to-br", tone.accent,
    )}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn(
            "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full",
            tone.chip,
          )}>
            {isUnlimited ? "Sınırsız" : status === "expiring" ? "Süre azalıyor" : "Aktif"}
          </span>
          {isUnlimited && <Sparkles className="w-3 h-3 text-fuchsia-300" />}
        </div>
        <h2 className="text-3xl font-black tracking-tight leading-none">
          {session.childName}
        </h2>
        <p className="text-[11px] text-white/40 mt-2">
          <span className="font-mono font-semibold">{session.entryTime}</span> giriş
          {session.totalMinutes > 0 && (
            <>
              {" · "}
              <span>{session.totalMinutes} dk paket</span>
            </>
          )}
        </p>
      </div>

      {/* Time display */}
      <div className="px-6 py-7 flex-1 flex flex-col items-center justify-center">
        <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-white/30 mb-2">
          Kalan Süre
        </p>
        <p className={cn(
          "font-black tabular-nums leading-none tracking-tighter",
          // Massive numbers for at-a-distance reading
          isUnlimited ? "text-7xl" : "text-8xl",
          tone.timeFg,
        )}>
          {isUnlimited ? "∞" : formatTime(session.remainingSeconds)}
        </p>

        {/* Progress bar (only for timed sessions) */}
        {!isUnlimited && session.totalMinutes > 0 && (
          <div className="w-full max-w-xs mt-6">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-linear",
                  isCritical ? "bg-rose-400"
                  : isWarning ? "bg-amber-400"
                  : "bg-emerald-400",
                )}
                style={{
                  width: `${Math.max(0, Math.min(100,
                    (session.remainingSeconds / (session.totalMinutes * 60)) * 100,
                  ))}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-white/30 font-mono">
              <span>Başlangıç</span>
              <span>Bitiş</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer: package details */}
      <div className="px-6 py-4 border-t border-white/[0.06] grid grid-cols-3 gap-3 text-center">
        <Detail icon={Baby}      label="Yaş"    value={session.childAge?.toString() ?? "—"} />
        <Detail icon={Clock}     label="Paket"  value={isUnlimited ? "Sınırsız" : `${session.totalMinutes}dk`} />
        <Detail icon={ShieldCheck} label="Durum" value={isCritical ? "Bitiyor" : isWarning ? "Az kaldı" : "Aktif"} />
      </div>
    </aside>
  )
}

function Detail({ icon: Icon, label, value }: { icon: typeof Baby; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <Icon className="w-2.5 h-2.5 text-white/30" />
        <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">{label}</p>
      </div>
      <p className="text-sm font-bold text-white/85 tabular-nums">{value}</p>
    </div>
  )
}
