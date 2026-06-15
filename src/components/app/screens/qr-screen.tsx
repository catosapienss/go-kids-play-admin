"use client"

import { useState } from "react"
import { RefreshCw, Share2 } from "lucide-react"
import { APP_USER, APP_CHILDREN, ACTIVE_PACKAGE } from "@/lib/app-data"
import { cn } from "@/lib/utils"

/* 21×21 QR module grid — hardcoded finder patterns + sample data modules */
const QR_MODULES: number[][] = (() => {
  const grid = Array.from({ length: 21 }, () => Array(21).fill(0))

  // Finder pattern top-left (7×7)
  const fp = (r: number, c: number) => {
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 7; j++) {
        const border = i === 0 || i === 6 || j === 0 || j === 6
        const inner = i >= 2 && i <= 4 && j >= 2 && j <= 4
        if (r + i < 21 && c + j < 21) grid[r + i][c + j] = border || inner ? 1 : 0
      }
  }
  fp(0, 0)   // top-left
  fp(0, 14)  // top-right
  fp(14, 0)  // bottom-left

  // Timing patterns (row 6, col 6)
  for (let i = 8; i <= 12; i++) { grid[6][i] = i % 2 === 0 ? 1 : 0; grid[i][6] = i % 2 === 0 ? 1 : 0 }

  // Fake data modules (seeded pseudo-random for visual realism)
  const seed = [
    [1,0,1,1,0,1,0,1],[0,1,0,1,1,0,1,0],[1,1,0,0,1,0,1,1],[0,0,1,1,0,1,0,1],
    [1,0,1,0,1,1,0,0],[0,1,0,0,0,1,1,0],[1,1,1,0,1,0,0,1],[0,0,0,1,1,1,0,1],
  ]
  for (let r = 8; r <= 12; r++)
    for (let c = 8; c <= 12; c++)
      grid[r][c] = seed[(r - 8) % seed.length][(c - 8) % seed[0].length]

  for (let r = 8; r <= 20; r++)
    for (let c = 8; c <= 13; c++)
      if (grid[r][c] === 0 && r > 12) grid[r][c] = seed[r % 8][c % 8]

  for (let r = 15; r <= 20; r++)
    for (let c = 0; c <= 6; c++)
      if (grid[r][c] === 0) grid[r][c] = seed[r % 8][c % 8]

  return grid
})()

export function QrScreen() {
  const [refreshed, setRefreshed] = useState(false)

  function handleRefresh() {
    setRefreshed(true)
    setTimeout(() => setRefreshed(false), 1500)
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#0a0a14] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 pt-2 pb-10 px-5">
        <p className="text-white/60 text-sm mb-0.5">Dijital Giriş</p>
        <p className="text-white font-black text-2xl">QR Giriş</p>
      </div>

      <div className="px-4 -mt-6 flex flex-col gap-4 flex-1">
        {/* Apple Wallet–style card */}
        <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 rounded-3xl overflow-hidden shadow-2xl shadow-violet-900/50">
          {/* Card top */}
          <div className="px-5 pt-5 pb-4 flex items-start justify-between">
            <div>
              <p className="text-white/40 text-[10px] font-black tracking-widest uppercase">Go Kids Play</p>
              <p className="text-white font-black text-lg mt-0.5">{APP_USER.fullName}</p>
              <p className="text-white/50 text-xs">{APP_USER.memberCode}</p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-[10px] font-black tracking-widest uppercase">Paket</p>
              <p className="text-white font-bold text-sm">{ACTIVE_PACKAGE.name}</p>
              <p className="text-white/50 text-[11px]">{ACTIVE_PACKAGE.remainingLabel} kaldı</p>
            </div>
          </div>

          {/* QR code */}
          <div className="mx-5 mb-4 bg-white rounded-2xl p-4 flex items-center justify-center">
            <div className={cn("transition-opacity duration-300", refreshed ? "opacity-30" : "opacity-100")}>
              <svg width="160" height="160" viewBox="0 0 21 21">
                {QR_MODULES.map((row, r) =>
                  row.map((cell, c) =>
                    cell === 1 ? (
                      <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#1e1b4b" />
                    ) : null
                  )
                )}
              </svg>
            </div>
          </div>

          {/* Member since strip */}
          <div className="px-5 pb-5 flex items-center justify-between">
            <div>
              <p className="text-white/40 text-[10px] font-black tracking-widest uppercase">Üye Olunduğu Tarih</p>
              <p className="text-white font-bold text-sm">{APP_USER.memberSince}</p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-[10px] font-black tracking-widest uppercase">Ziyaret</p>
              <p className="text-white font-bold text-sm">{APP_USER.totalVisits}× Ziyaret</p>
            </div>
          </div>
        </div>

        {/* Child selector */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kim için giriş?</p>
          </div>
          {APP_CHILDREN.map((c, i) => (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                i < APP_CHILDREN.length - 1 && "border-b border-slate-50 dark:border-slate-800",
                !c.inside && "hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-black text-base flex-shrink-0",
                c.gradient
              )}>
                {c.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{c.name}</p>
                <p className="text-xs text-slate-400">{c.age} yaş</p>
              </div>
              {c.inside ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">İçeride</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-violet-100 dark:bg-violet-500/20 rounded-xl">
                  <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">Giriş Yap</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action row */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 flex-1 justify-center py-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-sm font-semibold text-slate-600 dark:text-slate-400 active:scale-95 transition-transform"
          >
            <RefreshCw className={cn("w-4 h-4", refreshed && "animate-spin")} />
            Yenile
          </button>
          <button className="flex items-center gap-2 flex-1 justify-center py-3.5 bg-violet-600 rounded-2xl shadow-sm text-sm font-semibold text-white active:scale-95 transition-transform">
            <Share2 className="w-4 h-4" />
            Paylaş
          </button>
        </div>
      </div>
    </div>
  )
}
