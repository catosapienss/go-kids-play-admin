"use client"

import { useEffect, useState } from "react"
import { Bell, ChevronRight, Zap, Clock, CalendarDays, QrCode } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  APP_USER, APP_CHILDREN, ACTIVE_PACKAGE, CAMPAIGNS, EVENTS, formatSeconds
} from "@/lib/app-data"
import type { AppScreen } from "@/components/app/bottom-nav"

interface HomeScreenProps {
  onNavigate: (screen: AppScreen) => void
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [childSeconds, setChildSeconds] = useState(APP_CHILDREN[0].remainingSeconds)

  useEffect(() => {
    const id = setInterval(() => setChildSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const pct = Math.round((childSeconds / APP_CHILDREN[0].totalSeconds) * 100)
  const totalBalance = APP_USER.walletBalance + APP_USER.bonusBalance

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#0a0a14]">
      {/* Hero gradient header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 pt-2 pb-8 px-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-white/5 rounded-full translate-y-16" />

        {/* Header row */}
        <div className="relative flex items-center justify-between mb-6">
          <div>
            <p className="text-white/60 text-sm">Hoş geldin 👋</p>
            <p className="text-white font-black text-2xl leading-tight mt-0.5">{APP_USER.firstName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
              <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-400 rounded-full" />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-black text-white">
              {APP_USER.firstName.charAt(0)}
            </div>
          </div>
        </div>

        {/* Wallet card */}
        <div className="relative bg-white/12 backdrop-blur-sm rounded-3xl p-5 border border-white/15">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-1">Cüzdan Bakiyesi</p>
              <p className="text-white font-black text-4xl tabular-nums leading-none">
                ₺{APP_USER.walletBalance.toLocaleString("tr-TR")}
              </p>
              {APP_USER.bonusBalance > 0 && (
                <p className="text-white/50 text-xs mt-1.5">
                  +₺{APP_USER.bonusBalance} bonus · Toplam ₺{totalBalance.toLocaleString("tr-TR")}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wide mb-1">Aktif Paket</p>
              <p className="text-white text-sm font-bold">{ACTIVE_PACKAGE.name}</p>
              <p className="text-white/60 text-xs">{ACTIVE_PACKAGE.remainingLabel} kaldı</p>
            </div>
          </div>

          {/* Package progress */}
          <div>
            <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${Math.round((ACTIVE_PACKAGE.remainingSeconds / ACTIVE_PACKAGE.totalSeconds) * 100)}%` }}
              />
            </div>
            <p className="text-white/30 text-[10px] mt-1">Geçerlilik: {ACTIVE_PACKAGE.validUntil}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onNavigate("wallet")}
              className="flex-1 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors"
            >
              Yükle
            </button>
            <button
              onClick={() => onNavigate("qr")}
              className="flex-1 py-2.5 rounded-xl bg-white text-violet-700 text-xs font-bold transition-colors hover:bg-white/90"
            >
              QR Giriş
            </button>
            <button
              onClick={() => onNavigate("packages")}
              className="flex-1 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors"
            >
              Paket Al
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-4 space-y-4">
        {/* Child status card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-black text-lg")}>
                  {APP_CHILDREN[0].name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <p className="text-white font-black text-base">{APP_CHILDREN[0].name} İçeride!</p>
                  </div>
                  <p className="text-white/70 text-xs">Giriş: {APP_CHILDREN[0].entryTime}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-black text-2xl tabular-nums">{formatSeconds(childSeconds)}</p>
                <p className="text-white/60 text-[10px]">kalan süre</p>
              </div>
            </div>
            <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-1000"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {/* Arda row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-black text-sm">
              {APP_CHILDREN[1].name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{APP_CHILDREN[1].name}</p>
              <p className="text-xs text-slate-400">{APP_CHILDREN[1].age} yaş · Dışarıda</p>
            </div>
            <button
              onClick={() => onNavigate("qr")}
              className="flex items-center gap-1 px-3 py-1.5 bg-violet-100 dark:bg-violet-500/20 rounded-xl text-xs font-semibold text-violet-700 dark:text-violet-400"
            >
              <QrCode className="w-3.5 h-3.5" />
              Giriş Yap
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: QrCode, label: "QR Giriş", screen: "qr" as AppScreen, color: "bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" },
            { icon: Zap, label: "Süre Uzat", screen: "packages" as AppScreen, color: "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400" },
            { icon: Clock, label: "Paket Al", screen: "packages" as AppScreen, color: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
            { icon: CalendarDays, label: "Rezerve", screen: "packages" as AppScreen, color: "bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400" },
          ].map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                onClick={() => onNavigate(action.screen)}
                className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", action.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center leading-tight">{action.label}</span>
              </button>
            )
          })}
        </div>

        {/* Campaigns */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black text-slate-900 dark:text-white">Kampanyalar</p>
            <button className="text-xs font-semibold text-violet-600 dark:text-violet-400">Tümü →</button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {CAMPAIGNS.map((c) => (
              <div
                key={c.id}
                className={cn("flex-shrink-0 w-44 rounded-2xl bg-gradient-to-br p-4 text-white cursor-pointer active:scale-95 transition-transform", c.gradient)}
              >
                <span className="text-2xl">{c.icon}</span>
                <p className="text-sm font-black mt-2 leading-tight">{c.title}</p>
                <p className="text-white/70 text-[11px] mt-0.5">{c.subtitle}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming events */}
        <div className="pb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black text-slate-900 dark:text-white">Yaklaşan Etkinlikler</p>
          </div>
          <div className="space-y-2.5">
            {EVENTS.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl flex-shrink-0">
                  {ev.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{ev.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{ev.date} · {ev.time}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{ev.spots} yer</p>
                  <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
