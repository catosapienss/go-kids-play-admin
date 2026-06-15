"use client"

import { useState } from "react"
import { Check, Star, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_PACKAGES } from "@/lib/app-data"
import type { AppPackage } from "@/lib/app-data"

export function PackagesScreen() {
  const [selected, setSelected] = useState<string | null>(null)
  const [purchased, setPurchased] = useState<string | null>(null)

  function handleBuy(pkg: AppPackage) {
    if (purchased) return
    setSelected(pkg.id)
    setTimeout(() => {
      setPurchased(pkg.id)
    }, 600)
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#0a0a14]">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 pt-2 pb-6 px-5">
        <p className="text-white/60 text-sm mb-0.5">Planlar & Fiyatlar</p>
        <p className="text-white font-black text-2xl">Paket Seçin</p>
        <p className="text-white/50 text-xs mt-1">İhtiyacınıza uygun paketi seçin</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {APP_PACKAGES.map((pkg) => {
          const isSelected = selected === pkg.id
          const isPurchased = purchased === pkg.id

          return (
            <div
              key={pkg.id}
              onClick={() => handleBuy(pkg)}
              className={cn(
                "relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 active:scale-[0.98]",
                pkg.popular
                  ? "shadow-lg shadow-violet-500/20"
                  : "shadow-sm",
                isPurchased && "scale-[0.99]"
              )}
            >
              {/* Popular badge */}
              {pkg.popular && (
                <div className="absolute top-0 right-0 z-10">
                  <div className="bg-amber-400 text-amber-900 text-[10px] font-black px-3 py-1 rounded-bl-2xl flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    EN POPÜLER
                  </div>
                </div>
              )}

              {/* Card */}
              <div className={cn(
                "bg-gradient-to-br p-5 text-white",
                pkg.gradient
              )}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-black text-xl">{pkg.name}</p>
                    <p className="text-white/60 text-xs mt-0.5">{pkg.tagline}</p>
                  </div>
                  <div className="text-right">
                    {pkg.oldPrice && (
                      <p className="text-white/40 text-sm line-through">₺{pkg.oldPrice.toLocaleString("tr-TR")}</p>
                    )}
                    <p className="font-black text-2xl">₺{pkg.price.toLocaleString("tr-TR")}</p>
                    <p className="text-white/50 text-[11px]">{pkg.duration}</p>
                  </div>
                </div>

                {pkg.bonus && (
                  <div className="inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 mb-3">
                    <Zap className="w-3 h-3 text-amber-300 fill-current" />
                    <span className="text-[11px] font-bold text-amber-200">{pkg.bonus}</span>
                  </div>
                )}

                <div className="space-y-1.5 mb-4">
                  {pkg.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                      <span className="text-xs text-white/80">{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  className={cn(
                    "w-full py-3 rounded-2xl font-black text-sm transition-all duration-300",
                    isPurchased
                      ? "bg-white/30 text-white"
                      : isSelected
                      ? "bg-white/80 text-slate-700 scale-[0.98]"
                      : "bg-white text-slate-800 active:scale-[0.97]"
                  )}
                >
                  {isPurchased ? "✓ Satın Alındı!" : pkg.cta}
                </button>
              </div>
            </div>
          )
        })}

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 pb-4">
          Tüm paketler KDV dahildir · Kredi kartı ile ödeme
        </p>
      </div>
    </div>
  )
}
