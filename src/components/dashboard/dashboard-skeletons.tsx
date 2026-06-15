import { cn } from "@/lib/utils"

export function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={cn(
        "animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60",
        className,
      )}
    />
  )
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-3">
          <Shimmer className="h-3 w-16 mb-2" />
          <Shimmer className="h-6 w-20" />
        </div>
      ))}
    </div>
  )
}

export function PanelSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
      <Shimmer className="h-4 w-32 mb-4" />
      <Shimmer style={{ height }} className="w-full" />
    </div>
  )
}
