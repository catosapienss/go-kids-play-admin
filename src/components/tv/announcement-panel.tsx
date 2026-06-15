"use client"

import { useEffect, useState } from "react"
import { Camera } from "lucide-react"
import { cn } from "@/lib/utils"
import { ANNOUNCEMENTS } from "@/lib/tv-data"

const TYPE_COLORS = {
  campaign: { bg: "from-violet-600/20 to-purple-600/10", border: "border-violet-500/20", badge: "bg-violet-500/20 text-violet-300" },
  birthday: { bg: "from-rose-500/20 to-pink-600/10", border: "border-rose-500/20", badge: "bg-rose-500/20 text-rose-300" },
  event: { bg: "from-sky-500/20 to-blue-600/10", border: "border-sky-500/20", badge: "bg-sky-500/20 text-sky-300" },
  app: { bg: "from-emerald-500/20 to-teal-600/10", border: "border-emerald-500/20", badge: "bg-emerald-500/20 text-emerald-300" },
}

export function AnnouncementPanel() {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setCurrentIdx((i) => (i + 1) % ANNOUNCEMENTS.length)
        setVisible(true)
      }, 400)
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const ann = ANNOUNCEMENTS[currentIdx]
  const colors = TYPE_COLORS[ann.type]

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Section label */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-4 bg-violet-500 rounded-full" />
        <p className="text-white/40 text-[10px] font-black tracking-widest uppercase">Duyurular & Kampanyalar</p>
      </div>

      {/* Rotating announcement card */}
      <div
        className={cn(
          "rounded-2xl border bg-gradient-to-br p-5 flex-shrink-0 transition-all duration-400",
          colors.bg, colors.border,
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        )}
      >
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0">{ann.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-tight">{ann.title}</p>
            <p className="text-white/50 text-xs mt-1 leading-relaxed">{ann.subtitle}</p>
            {ann.highlight && (
              <span className={cn("inline-block mt-2 px-2.5 py-1 rounded-lg text-xs font-black", colors.badge)}>
                {ann.highlight}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 justify-center flex-shrink-0">
        {ANNOUNCEMENTS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full transition-all duration-300",
              i === currentIdx
                ? "w-4 h-1.5 bg-white/60"
                : "w-1.5 h-1.5 bg-white/15"
            )}
          />
        ))}
      </div>

      {/* Camera placeholder */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1 h-4 bg-emerald-500 rounded-full" />
          <p className="text-white/40 text-[10px] font-black tracking-widest uppercase">Canlı Kamera</p>
        </div>
        <div className="flex-1 rounded-2xl overflow-hidden relative border border-emerald-500/10 bg-[#070d0b] min-h-0">
          {/* Grid overlay - surveillance look */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,255,120,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,255,120,0.06) 1px, transparent 1px)
              `,
              backgroundSize: "24px 24px",
            }}
          />
          {/* Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.7)_100%)]" />
          {/* Corner brackets */}
          {["top-2 left-2 border-l-2 border-t-2", "top-2 right-2 border-r-2 border-t-2", "bottom-2 left-2 border-l-2 border-b-2", "bottom-2 right-2 border-r-2 border-b-2"].map((cls, i) => (
            <div key={i} className={cn("absolute w-4 h-4 border-emerald-500/40", cls)} />
          ))}
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-emerald-500/50" />
            </div>
            <p className="text-emerald-500/40 text-[10px] font-mono tracking-widest">OYUN ALANI · CAM-01</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] text-emerald-500/70 font-mono tracking-widest">CANLI YAYIN</span>
            </div>
          </div>
          {/* Timestamp overlay */}
          <div className="absolute bottom-2 right-2">
            <p className="text-[9px] font-mono text-emerald-500/30">REC ● 2026-05-11</p>
          </div>
        </div>
      </div>
    </div>
  )
}
