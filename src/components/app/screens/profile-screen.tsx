"use client"

import { useState } from "react"
import { ChevronRight, Bell, Shield, HelpCircle, LogOut, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_USER, APP_CHILDREN, WALLET_TRANSACTIONS } from "@/lib/app-data"

export function ProfileScreen() {
  const [notifPlay, setNotifPlay] = useState(true)
  const [notifCampaign, setNotifCampaign] = useState(true)
  const [notifTimer, setNotifTimer] = useState(true)

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#0a0a14]">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 pt-2 pb-10 px-5">
        <p className="text-white font-black text-2xl">Profilim</p>
      </div>

      <div className="px-4 -mt-6 space-y-4 pb-8">
        {/* User card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
              {APP_USER.firstName.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-black text-slate-900 dark:text-white text-lg">{APP_USER.fullName}</p>
              <p className="text-sm text-slate-400">{APP_USER.phone}</p>
              <p className="text-xs text-slate-400">{APP_USER.email}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="font-black text-slate-900 dark:text-white text-lg">{APP_USER.totalVisits}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Ziyaret</p>
            </div>
            <div className="text-center border-x border-slate-100 dark:border-slate-800">
              <p className="font-black text-slate-900 dark:text-white text-lg">{APP_CHILDREN.length}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Çocuk</p>
            </div>
            <div className="text-center">
              <p className="font-black text-violet-600 dark:text-violet-400 text-lg">₺{APP_USER.walletBalance}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Bakiye</p>
            </div>
          </div>
        </div>

        {/* Children */}
        <div>
          <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Çocuklarım</p>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            {APP_CHILDREN.map((child, i) => (
              <div
                key={child.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5",
                  i < APP_CHILDREN.length - 1 && "border-b border-slate-50 dark:border-slate-800"
                )}
              >
                <div className={cn("w-10 h-10 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-black text-base flex-shrink-0", child.gradient)}>
                  {child.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{child.name}</p>
                  <p className="text-xs text-slate-400">{child.age} yaş</p>
                </div>
                {child.inside && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">İçeride</span>
                  </div>
                )}
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            ))}
            <button className="w-full flex items-center justify-center gap-2 py-3.5 border-t border-slate-50 dark:border-slate-800 text-violet-600 dark:text-violet-400 text-sm font-semibold active:bg-slate-50 dark:active:bg-slate-800 transition-colors">
              + Çocuk Ekle
            </button>
          </div>
        </div>

        {/* Son işlemler */}
        <div>
          <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Son İşlemler</p>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            {WALLET_TRANSACTIONS.slice(0, 3).map((tx, i) => (
              <div
                key={tx.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i < 2 && "border-b border-slate-50 dark:border-slate-800"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black",
                  tx.type === "use" ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600" :
                  tx.type === "load" ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600" :
                  "bg-violet-100 dark:bg-violet-500/20 text-violet-600"
                )}>
                  {tx.type === "use" ? "↑" : tx.type === "bonus" ? "★" : "↓"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{tx.description}</p>
                  <p className="text-[10px] text-slate-400">{tx.date}</p>
                </div>
                <p className={cn(
                  "text-xs font-black flex-shrink-0",
                  tx.type === "use" ? "text-rose-500" : "text-emerald-500"
                )}>
                  {tx.type === "use" ? "-" : "+"}₺{tx.amount}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bildirimler */}
        <div>
          <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Bildirim Ayarları</p>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            {[
              { label: "Oyun Süresi Uyarısı", desc: "Süre dolmadan 10 dk önce", value: notifTimer, set: setNotifTimer },
              { label: "Oyun Aktivitesi", desc: "Giriş/çıkış bildirimleri", value: notifPlay, set: setNotifPlay },
              { label: "Kampanyalar", desc: "İndirim ve fırsatlar", value: notifCampaign, set: setNotifCampaign },
            ].map((item, i) => (
              <div key={item.label} className={cn("flex items-center gap-3 px-4 py-3.5", i < 2 && "border-b border-slate-50 dark:border-slate-800")}>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <button
                  onClick={() => item.set(!item.value)}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
                    item.value ? "bg-violet-600" : "bg-slate-200 dark:bg-slate-700"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200",
                    item.value ? "translate-x-5.5" : "translate-x-0.5"
                  )} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div>
          <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Ayarlar</p>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            {[
              { icon: Shield, label: "Güvenlik", desc: "Şifre ve PIN", color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20" },
              { icon: Bell, label: "Bildirimler", desc: "Tüm ayarlar", color: "text-violet-600 bg-violet-100 dark:bg-violet-500/20" },
              { icon: HelpCircle, label: "Yardım & Destek", desc: "SSS ve iletişim", color: "text-sky-600 bg-sky-100 dark:bg-sky-500/20" },
              { icon: Smartphone, label: "Uygulama Hakkında", desc: "Sürüm 2.1.0", color: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  className={cn("w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 dark:active:bg-slate-800 transition-colors", i < 3 && "border-b border-slate-50 dark:border-slate-800")}
                >
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", item.color)}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Logout */}
        <button className="w-full flex items-center justify-center gap-2 py-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-800/30 text-rose-600 dark:text-rose-400 font-semibold text-sm active:scale-95 transition-transform">
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </button>

        <p className="text-center text-[10px] text-slate-300 dark:text-slate-700 pb-2">
          Go Kids Play · Üye: {APP_USER.memberSince} · {APP_USER.memberCode}
        </p>
      </div>
    </div>
  )
}
