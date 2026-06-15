"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search, Zap, UserPlus, Activity, Wallet, FileText, Cake, Users,
  TrendingUp, ArrowRight, Command,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { canAccessRoute } from "@/lib/permissions"

// ─── Global Quick Actions Launcher ────────────────────────────────────────────
//
// Cmd+K / Ctrl+K opens a fuzzy-search palette that lets the operator jump
// straight to any high-traffic action. Mounted once in the root layout; no
// per-page wiring required.
//
// Tablet hint: also opens via long-press on the touch trigger (added later
// to header if needed) — for now keyboard-only is enough for kasiyer flow.

interface QuickAction {
  id: string
  label: string
  hint?: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  /** Free-form search tokens — includes label by default. */
  keywords?: string[]
  /** Role gate — anyone matching `canAccessRoute(href)` sees it. */
}

const ACTIONS: QuickAction[] = [
  { id: "new-customer", label: "Yeni müşteri kaydı",     hint: "Hızlı kayıt", href: "/hizli-kayit",   icon: UserPlus,    keywords: ["kayit","giris","yeni","veli","cocuk","new","entry"] },
  { id: "active-game",  label: "Aktif oyun alanı",        hint: "Canlı süre yönetimi", href: "/aktif-oyun", icon: Activity, keywords: ["aktif","oyun","sure","canli","timer","floor"] },
  { id: "wallet",       label: "Cüzdan",                  hint: "Bakiye + yükleme", href: "/cuzdan",    icon: Wallet,      keywords: ["cuzdan","wallet","bakiye","yukleme","balance"] },
  { id: "crm",          label: "Müşteri (CRM)",           hint: "Veli & çocuk listesi", href: "/crm",   icon: Users,       keywords: ["crm","musteri","veli","cocuk","customer"] },
  { id: "birthdays",    label: "Doğum günleri & Organizasyon", href: "/dogum-gunleri", icon: Cake,        keywords: ["dogum","organizasyon","etkinlik","birthday","party"] },
  { id: "reports",      label: "Raporlar",                hint: "Trend ve dağılım grafikleri", href: "/raporlar", icon: FileText,    keywords: ["rapor","gun sonu","reconciliation","report","trend"] },
  { id: "day-end",      label: "Gün Sonu Kapanış",        hint: "Kasa sayımı + mutabakat", href: "/gun-sonu", icon: FileText, keywords: ["gun sonu","kasa","kapanis","close","day end","cash count","sayim","mutabakat"] },
  { id: "shift",        label: "Vardiya Yönetimi",        hint: "Aktif vardiya · personel aktiviteleri", href: "/personeller", icon: FileText, keywords: ["vardiya","shift","mesai","personel","staff","clock","saat","activity","aktivite"] },
  { id: "customers",    label: "Müşteri Arama",            hint: "Müşteri geçmişi · sadakat etiketleri", href: "/crm", icon: FileText, keywords: ["musteri","customer","crm","veli","loyalty","sadakat","vip","arama"] },
  { id: "memberships",  label: "Üyelikler",                hint: "Sınırsız · aylık · kontörlü · duraklatma", href: "/uyelikler", icon: FileText, keywords: ["uyelik","membership","subscription","abone","sinirsız","sinirsiz","kontor","duraklat","pause","aylik"] },
  { id: "parent",       label: "Veli Portalı",              hint: "Müşteri mobil deneyimi · yeni sekme", href: "/parent",      icon: FileText, keywords: ["parent","veli","portal","pwa","mobile","app","mobil","musteri","kod"] },
  { id: "tv-live",      label: "Canlı TV Ekranı",           hint: "Salon kiosk display · yeni sekme",   href: "/tv/live",    icon: FileText, keywords: ["tv","ekran","canli","live","display","kiosk","floor"] },
  { id: "canli-alan",   label: "Canlı Oyun Alanı",          hint: "Aile dostu canlı takip · kamera yakında", href: "/canli", icon: FileText, keywords: ["canli","kamera","video","alan","play","aile","family","watch","izle","oyun"] },
  { id: "durum",        label: "Sistem Özeti",              hint: "Kurulu modüller · operasyonel hazırlık", href: "/durum",  icon: FileText, keywords: ["durum","ozet","sistem","status","modul","module","ozeti","platform","overview"] },
  { id: "dashboard",    label: "Yönetici Paneli",          hint: "KPI + canlı operasyon",              href: "/",            icon: TrendingUp, keywords: ["dashboard","panel","ana","home","kpi"] },
  { id: "branches",     label: "Şubeler",                 hint: "Süper Admin", href: "/subeler", icon: Activity,           keywords: ["sube","branch","franchise","subdomain"] },
  { id: "staff",        label: "Personeller",             href: "/personeller", icon: Users,                              keywords: ["personel","staff","kasiyer","yonetici"] },
]

// ─── Diacritic-insensitive fuzzy matching ────────────────────────────────────

function normalize(s: string): string {
  return s.toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o")
}

function matchScore(action: QuickAction, query: string): number {
  if (!query) return 1
  const q = normalize(query)
  const haystack = normalize(
    [action.label, action.hint ?? "", ...(action.keywords ?? []), action.href].join(" "),
  )
  if (haystack.includes(q)) {
    // Prefer prefix matches in the label itself.
    const labelNorm = normalize(action.label)
    if (labelNorm.startsWith(q)) return 100
    if (labelNorm.includes(q))   return 50
    return 25
  }
  // Sub-token match (every space-separated token must appear somewhere).
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length > 1 && tokens.every((t) => haystack.includes(t))) return 10
  return 0
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QuickActionsLauncher() {
  const router = useRouter()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global keyboard shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"
      if (isCmdK) {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (!open) return
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // Focus the input on open + reset state when closing
  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Role-filtered + scored + sorted list
  const ranked = useMemo(() => {
    if (!user) return []
    return ACTIONS
      .filter((a) => canAccessRoute(a.href, user.role))
      .map((a) => ({ a, score: matchScore(a, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.a)
  }, [query, user])

  function run(action: QuickAction) {
    setOpen(false)
    router.push(action.href)
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, ranked.length - 1)) }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)) }
    else if (e.key === "Enter")     { e.preventDefault(); const a = ranked[activeIdx]; if (a) run(a) }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[15vh] bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-[fadeIn_120ms_ease-out]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-[520px] rounded-2xl",
          "bg-white dark:bg-slate-900",
          "border border-slate-200 dark:border-slate-800",
          "shadow-2xl shadow-slate-900/20 dark:shadow-black/50",
          "overflow-hidden flex flex-col",
          "animate-[scaleIn_140ms_ease-out]",
        )}
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Hızlı işlem ara — yeni müşteri, aktif oyun, raporlar…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={onInputKey}
            className="flex-1 bg-transparent border-0 outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <kbd className="text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">esc</kbd>
        </div>

        {/* Results */}
        <div className="flex-1 max-h-[60vh] overflow-y-auto p-1.5">
          {ranked.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Sonuç yok</p>
              <p className="text-[11px] text-slate-400 mt-1">Farklı bir terim dene.</p>
            </div>
          ) : (
            ranked.map((a, i) => {
              const active = i === activeIdx
              const Icon = a.icon
              return (
                <button
                  key={a.id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => run(a)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    active
                      ? "bg-violet-50 dark:bg-violet-500/[0.12]"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                    active
                      ? "bg-violet-500 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-semibold truncate",
                      active ? "text-violet-900 dark:text-violet-100" : "text-slate-800 dark:text-slate-200",
                    )}>
                      {a.label}
                    </p>
                    {a.hint && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{a.hint}</p>
                    )}
                  </div>
                  <ArrowRight className={cn(
                    "w-3.5 h-3.5 flex-shrink-0 transition-opacity",
                    active ? "opacity-100 text-violet-500" : "opacity-0",
                  )} />
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> Hızlı işlem
            </span>
            <span>↑↓ gezin · ↵ aç</span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" /> K
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
