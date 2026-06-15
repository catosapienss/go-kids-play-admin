import { Baby } from "lucide-react"

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950 z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
            <Baby className="w-8 h-8 text-white" />
          </div>
          {/* Spinner ring */}
          <svg
            className="absolute -inset-2 animate-spin text-violet-500/30"
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
          >
            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="4" strokeDasharray="56 170" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">GoKids Play</p>
          <p className="text-xs text-slate-400 mt-0.5">Yükleniyor...</p>
        </div>
      </div>
    </div>
  )
}
