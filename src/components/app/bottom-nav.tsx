import { Home, Package, QrCode, Wallet, User } from "lucide-react"
import { cn } from "@/lib/utils"

export type AppScreen = "home" | "packages" | "qr" | "wallet" | "profile"

const LEFT_TABS = [
  { id: "home" as AppScreen, label: "Ana Sayfa", icon: Home },
  { id: "packages" as AppScreen, label: "Paketler", icon: Package },
]
const RIGHT_TABS = [
  { id: "wallet" as AppScreen, label: "Cüzdan", icon: Wallet },
  { id: "profile" as AppScreen, label: "Profil", icon: User },
]

interface BottomNavProps {
  active: AppScreen
  onChange: (s: AppScreen) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="flex-shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl pb-safe">
      <div className="flex items-end h-16">
        {/* Left tabs */}
        {LEFT_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 h-full transition-colors"
            >
              <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-violet-600 dark:text-violet-400" : "text-slate-400")} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className={cn("text-[10px] font-semibold transition-colors", isActive ? "text-violet-600 dark:text-violet-400" : "text-slate-400")}>
                {tab.label}
              </span>
            </button>
          )
        })}

        {/* Center QR button — elevated */}
        <button
          onClick={() => onChange("qr")}
          className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-4 relative -top-3"
        >
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all",
            active === "qr"
              ? "bg-violet-600 shadow-violet-500/40"
              : "bg-gradient-to-br from-violet-600 to-purple-700 shadow-violet-500/30"
          )}>
            <QrCode className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <span className={cn("text-[10px] font-semibold", active === "qr" ? "text-violet-600 dark:text-violet-400" : "text-slate-400")}>
            QR Giriş
          </span>
        </button>

        {/* Right tabs */}
        {RIGHT_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 h-full transition-colors"
            >
              <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-violet-600 dark:text-violet-400" : "text-slate-400")} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className={cn("text-[10px] font-semibold transition-colors", isActive ? "text-violet-600 dark:text-violet-400" : "text-slate-400")}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
