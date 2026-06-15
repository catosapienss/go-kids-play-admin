"use client"

import { useEffect, useState } from "react"
import { Radio, Users, Sparkles, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandMark } from "@/components/brand-logo"
import { BRAND } from "@/lib/brand"
import { useBranch } from "@/lib/branch/branch-context"

// ─── TV Live Header ──────────────────────────────────────────────────────────
//
// Branded strip across the top of the TV. Three columns:
//
//   [Brand mark + wordmark]      [LIVE clock]        [Active counters]
//
// Designed to read from 4–5 meters away on a 43"-65" wall display.

interface Props {
  activeCount: number
  expiringCount: number
  unlimitedCount: number
}

export function TvLiveHeader({ activeCount, expiringCount, unlimitedCount }: Props) {
  const { activeBranch } = useBranch()
  const [now, setNow] = useState<Date>(() => new Date())

  // Tick the wall clock every second — single setInterval, cheap.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const ss = String(now.getSeconds()).padStart(2, "0")
  const dateText = now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })

  return (
    <header className="relative flex items-center justify-between px-8 lg:px-12 py-5 lg:py-6 border-b border-white/[0.06]">
      {/* Brand mark + wordmark */}
      <div className="flex items-center gap-4">
        <BrandMark size="xl" />
        <div className="hidden lg:block">
          <p className="text-2xl font-black tracking-tight leading-none">
            <span style={{ color: BRAND.mark.green }}>Go</span>
            <span style={{ color: BRAND.mark.pink }} className="mx-0.5">Kids</span>
            <span style={{ color: BRAND.mark.yellow }}>Play</span>
          </p>
          {activeBranch && (
            <p className="text-[11px] uppercase tracking-widest text-white/40 font-semibold mt-1.5">
              {activeBranch.branchName}
            </p>
          )}
        </div>
      </div>

      {/* Centre — wall clock */}
      <div className="hidden md:flex flex-col items-center">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="relative w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-pulse" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 font-bold">Canlı</span>
        </div>
        <p className="font-black tabular-nums text-white text-5xl lg:text-6xl leading-none tracking-tight">
          {hh}<span className="text-white/30 mx-0.5 lg:mx-1">:</span>{mm}<span className="text-white/30 mx-0.5 lg:mx-1 text-3xl lg:text-4xl">{ss}</span>
        </p>
        <p className="text-[11px] uppercase tracking-widest text-white/40 font-medium mt-1.5">
          {dateText}
        </p>
      </div>

      {/* Active counters */}
      <div className="flex items-center gap-3 lg:gap-5">
        <Counter label="İçeride"  value={activeCount}     icon={Users}        tone="emerald" />
        {unlimitedCount > 0 && (
          <Counter label="Sınırsız" value={unlimitedCount} icon={Sparkles}     tone="fuchsia" />
        )}
        {expiringCount > 0 && (
          <Counter label="Bitiyor" value={expiringCount}   icon={AlertCircle}  tone="amber" pulse />
        )}
      </div>
    </header>
  )
}

// ─── Counter atom ────────────────────────────────────────────────────────────

const TONE: Record<string, { wrap: string; iconBg: string; iconFg: string; valueFg: string }> = {
  emerald: { wrap: "border-emerald-500/30 bg-emerald-500/[0.08]", iconBg: "bg-emerald-500/20", iconFg: "text-emerald-300", valueFg: "text-emerald-200" },
  amber:   { wrap: "border-amber-500/40   bg-amber-500/[0.10]",   iconBg: "bg-amber-500/20",   iconFg: "text-amber-300",   valueFg: "text-amber-200" },
  fuchsia: { wrap: "border-fuchsia-500/30 bg-fuchsia-500/[0.08]", iconBg: "bg-fuchsia-500/20", iconFg: "text-fuchsia-300", valueFg: "text-fuchsia-200" },
}

function Counter({ label, value, icon: Icon, tone, pulse }: {
  label: string
  value: number
  icon: typeof Users
  tone: keyof typeof TONE
  pulse?: boolean
}) {
  const t = TONE[tone]
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-2xl border px-4 lg:px-5 py-3 backdrop-blur-sm",
      t.wrap,
      pulse && "animate-pulse",
    )}>
      <div className={cn("w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center", t.iconBg, t.iconFg)}>
        <Icon className="w-4 h-4 lg:w-5 lg:h-5" />
      </div>
      <div className="leading-none">
        <p className={cn("text-3xl lg:text-4xl font-black tabular-nums", t.valueFg)}>{value}</p>
        <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mt-1">{label}</p>
      </div>
    </div>
  )
}
