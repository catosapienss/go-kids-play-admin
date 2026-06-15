"use client"

import { useEffect, useState } from "react"
import { Users, Wifi } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"

interface TopBarProps {
  childCount: number
  activeCount: number
}

export function TopBar({ childCount, activeCount }: TopBarProps) {
  const [time, setTime] = useState("")
  const [date, setDate] = useState("")

  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }))
      setDate(now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="flex-shrink-0 flex items-center justify-between px-8 h-20 border-b border-white/[0.06]">
      {/* Logo */}
      <BrandLogo size="md" on="dark" />

      {/* Center: stats */}
      <div className="flex items-center gap-6">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-4 h-4">
            <span className="w-3 h-3 bg-emerald-500 rounded-full" />
            <span className="absolute w-3 h-3 bg-emerald-500 rounded-full animate-ping opacity-60" />
          </div>
          <span className="text-emerald-400 text-xs font-black tracking-widest uppercase">Canlı</span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10" />

        {/* Child count */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center">
            <Users className="w-4 h-4 text-white/60" />
          </div>
          <div>
            <p className="text-white font-black text-xl tabular-nums leading-none">{childCount}</p>
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Çocuk İçeride</p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10" />

        {/* Active count */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Wifi className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-emerald-400 font-black text-xl tabular-nums leading-none">{activeCount}</p>
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Aktif Seans</p>
          </div>
        </div>
      </div>

      {/* Clock + date */}
      <div className="text-right">
        <p className="text-white font-black text-3xl tabular-nums leading-none tracking-tight">
          {time}
        </p>
        <p className="text-white/30 text-xs font-semibold mt-1 capitalize">{date}</p>
      </div>
    </header>
  )
}
