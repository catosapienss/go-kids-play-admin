"use client"

import { usePackageMetrics, useExtensionMetrics } from "@/hooks/use-analytics"
import { PanelSkeleton } from "./dashboard-skeletons"
import { cn } from "@/lib/utils"
import { Package, Repeat, Sparkles } from "lucide-react"

const TONE: Record<string, { bar: string; fg: string }> = {
  "30dk":    { bar: "bg-blue-500",    fg: "text-blue-700 dark:text-blue-400" },
  "60dk":    { bar: "bg-violet-500",  fg: "text-violet-700 dark:text-violet-400" },
  "90dk":    { bar: "bg-indigo-500",  fg: "text-indigo-700 dark:text-indigo-400" },
  "Serbest": { bar: "bg-fuchsia-500", fg: "text-fuchsia-700 dark:text-fuchsia-400" },
}

export function PopularPackagesPanel() {
  const { data: pkgs, isLoading: l1 } = usePackageMetrics()
  const { data: ext, isLoading: l2 } = useExtensionMetrics()

  if (l1 || l2 || !pkgs || !ext) return <PanelSkeleton height={300} />

  const max = Math.max(1, ...pkgs.map((p) => p.count))

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
          <Package className="w-3.5 h-3.5" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Popüler Paketler</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Son 7 gün</p>
        </div>
      </div>

      <div className="space-y-2.5 flex-1">
        {pkgs.map((p) => {
          const t = TONE[p.packageType] ?? TONE["60dk"]
          return (
            <div key={p.packageType}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{p.label}</span>
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className={cn("text-sm font-bold", t.fg)}>{p.count}</span>
                  <span className="text-[10px] text-slate-400">%{(p.share * 100).toFixed(0)}</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={cn("h-full rounded-full", t.bar)} style={{ width: `${(p.count / max) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Repeat className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              %{(ext.extensionRate * 100).toFixed(0)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Uzatma oranı</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{ext.unlimitedConversions}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Sınırsız geçiş</p>
          </div>
        </div>
      </div>
    </div>
  )
}
