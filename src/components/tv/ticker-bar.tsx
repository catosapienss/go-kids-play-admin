import { TICKER_MESSAGES } from "@/lib/tv-data"

export function TickerBar() {
  const tickerContent = TICKER_MESSAGES.join("   ·   ")
  const doubled = `${tickerContent}   ·   ${tickerContent}`

  return (
    <footer className="flex-shrink-0 h-11 border-t border-white/[0.06] bg-white/[0.02] flex items-center overflow-hidden gap-4">
      {/* Label */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 border-r border-white/[0.08] h-full">
        <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
        <span className="text-violet-400/80 text-[10px] font-black tracking-widest uppercase whitespace-nowrap">Bilgi</span>
      </div>

      {/* Scrolling text */}
      <div className="flex-1 overflow-hidden">
        <div className="animate-tv-ticker whitespace-nowrap inline-block">
          <span className="text-white/35 text-xs font-medium">{doubled}</span>
        </div>
      </div>
    </footer>
  )
}
