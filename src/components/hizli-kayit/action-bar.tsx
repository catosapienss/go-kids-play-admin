"use client"

import { Play, Timer, X, RefreshCw, QrCode, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActionBarProps {
  canStart: boolean
  isProcessing: boolean
  onStart: () => void
  onExtend: () => void
  onCancel: () => void
  onClear: () => void
  onQr: () => void
}

export function ActionBar({
  canStart,
  isProcessing,
  onStart,
  onExtend,
  onCancel,
  onClear,
  onQr,
}: ActionBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
      {/* Primary CTA */}
      <button
        onClick={onStart}
        disabled={!canStart || isProcessing}
        className={cn(
          "flex items-center gap-2.5 px-6 py-3 rounded-2xl font-semibold text-sm transition-all flex-shrink-0",
          canStart && !isProcessing
            ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 active:scale-95"
            : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
        )}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4" fill="currentColor" />
        )}
        {isProcessing ? "İşleniyor..." : "Girişi Başlat"}
      </button>

      <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

      {/* Secondary actions */}
      <div className="flex items-center gap-1.5 flex-1 flex-wrap">
        <ActionButton
          onClick={onExtend}
          icon={Timer}
          label="Süre Uzat"
          className="border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
        />
        <ActionButton
          onClick={onQr}
          icon={QrCode}
          label="QR Oluştur"
          className="border-sky-200 dark:border-sky-500/20 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10"
        />
        <ActionButton
          onClick={onClear}
          icon={RefreshCw}
          label="Temizle"
          className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
        />
        <ActionButton
          onClick={onCancel}
          icon={X}
          label="İptal Et"
          className="border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
        />
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  icon: Icon,
  label,
  className,
}: {
  onClick: () => void
  icon: React.ElementType
  label: string
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-95",
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
