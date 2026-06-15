import { CheckCircle2, Users, Clock, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Organization } from "@/types/organizasyon"
import { getPackageById, ORG_PACKAGES } from "@/lib/organizasyon-data"

export function PackageManager({ org }: { org: Organization }) {
  const activePkg = getPackageById(org.packageId)

  return (
    <div className="space-y-4">
      {/* Active package highlight */}
      {activePkg && (
        <div className={cn("rounded-2xl overflow-hidden shadow-sm border-2 border-transparent", `ring-2 ring-${activePkg.color}-400/30`)}>
          <div className={cn("bg-gradient-to-r p-5 text-white", activePkg.gradient)}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Seçili Paket</span>
                </div>
                <h3 className="text-xl font-bold">{activePkg.name}</h3>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">₺{activePkg.price.toLocaleString("tr-TR")}</p>
                <p className="text-white/70 text-xs">baz fiyat</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 bg-white/20 rounded-lg px-2.5 py-1.5 text-sm font-semibold">
                <Users className="w-3.5 h-3.5" />
                Maks. {activePkg.childLimit} çocuk
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 rounded-lg px-2.5 py-1.5 text-sm font-semibold">
                <Clock className="w-3.5 h-3.5" />
                {activePkg.durationHours} saat
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Paket İçeriği</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activePkg.includes.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Extra children */}
      {org.extraChildCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Ekstra Çocuklar</span>
            </div>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">+{org.extraChildCount} çocuk</span>
          </div>
        </div>
      )}

      {/* All packages comparison */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Diğer Paketler</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ORG_PACKAGES.filter((p) => p.id !== org.packageId).map((pkg) => (
            <div key={pkg.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 opacity-60">
              <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold flex-shrink-0", pkg.gradient)}>
                {pkg.childLimit}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{pkg.name}</p>
                <p className="text-[10px] text-slate-500">{pkg.durationHours}sa · Maks {pkg.childLimit} çocuk</p>
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">₺{pkg.price.toLocaleString("tr-TR")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
