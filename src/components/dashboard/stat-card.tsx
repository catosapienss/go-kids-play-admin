import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: "default" | "primary" | "success" | "warning" | "danger"
}

const variantStyles = {
  default: {
    card: "bg-white dark:bg-slate-900",
    icon: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    trend: "text-slate-500",
  },
  primary: {
    card: "bg-gradient-to-br from-violet-500 to-purple-600 text-white",
    icon: "bg-white/20 text-white",
    trend: "text-violet-100",
  },
  success: {
    card: "bg-white dark:bg-slate-900",
    icon: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    trend: "text-emerald-600",
  },
  warning: {
    card: "bg-white dark:bg-slate-900",
    icon: "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
    trend: "text-amber-600",
  },
  danger: {
    card: "bg-white dark:bg-slate-900",
    icon: "bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400",
    trend: "text-red-600",
  },
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) {
  const styles = variantStyles[variant]
  const isPrimary = variant === "primary"

  return (
    <Card className={cn(
      "p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0",
      styles.card
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", styles.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 text-xs font-medium", isPrimary ? styles.trend : "text-emerald-600 dark:text-emerald-400")}>
            <span>↑</span>
            <span>+{trend.value}%</span>
          </div>
        )}
      </div>
      <div>
        <p className={cn("text-2xl font-bold tracking-tight", isPrimary ? "text-white" : "text-slate-900 dark:text-white")}>
          {value}
        </p>
        <p className={cn("text-sm mt-0.5", isPrimary ? "text-violet-100" : "text-slate-500 dark:text-slate-400")}>
          {title}
        </p>
        {subtitle && (
          <p className={cn("text-xs mt-1", styles.trend)}>
            {subtitle}
          </p>
        )}
      </div>
    </Card>
  )
}
