"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Circle, RotateCcw, FlaskConical, AlertTriangle, Shield, Activity, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── E2E Test Scenario Checklist ─────────────────────────────────────────────
//
// An in-app manual QA driver. Each scenario lists the steps an operator must
// perform; toggling the checkbox persists locally so a long QA session can be
// resumed across reloads. This is *not* automated testing — it's a structured
// path through every critical operation flow.

interface Scenario {
  id: string
  title: string
  steps: string[]
  passCriteria: string
}

interface ScenarioGroup {
  id: string
  title: string
  icon: typeof FlaskConical
  tone: "violet" | "amber" | "rose" | "emerald" | "blue"
  scenarios: Scenario[]
}

const GROUPS: ScenarioGroup[] = [
  {
    id: "core-ops",
    title: "Operasyon Akışları",
    icon: FlaskConical,
    tone: "violet",
    scenarios: [
      {
        id: "new-customer",
        title: "Yeni müşteri kaydı",
        steps: [
          "Hızlı kayıt → 'Yeni müşteri' butonuna bas",
          "Veli adı + telefon gir, çocuk ekle (en az 1)",
          "Paket seç (60 dk), ödeme yöntemi: Nakit",
          "Girişi başlat",
        ],
        passCriteria: "Dashboard'da Aktif Oyun sayısı +1, ses + toast 'X oyuna başladı'",
      },
      {
        id: "existing-search",
        title: "Mevcut müşteri arama",
        steps: [
          "Hızlı kayıt → veli telefonunun son 4 hanesini ara",
          "Sonuçtan veliyi seç, çocuğunu seç",
          "Paket seç → ödeme → girişi başlat",
        ],
        passCriteria: "Hız < 10 saniye; veli/çocuk bilgisi otomatik dolu gelir",
      },
      {
        id: "multi-child",
        title: "Çoklu çocuk girişi",
        steps: [
          "Aynı veliye ait 2 çocuğu peş peşe ekle",
          "Her çocuk için ayrı paket + ödeme",
        ],
        passCriteria: "2 ayrı session oluşur; veli aynı; aktif oyunda 2 satır görünür",
      },
      {
        id: "split-payment",
        title: "Split payment (Nakit + Kart + Cüzdan)",
        steps: [
          "Yeni session başlat",
          "Toplam ₺200 için: ₺50 Nakit + ₺100 Kart + ₺50 Cüzdan gir",
          "Onayla",
        ],
        passCriteria: "Dashboard'da Nakit/Kart/Cüzdan dağılımı +50/+100/+50; payment toplamı ₺200",
      },
      {
        id: "wallet-payment",
        title: "Cüzdan ödeme (tam tutar)",
        steps: [
          "Cüzdan bakiyesi olan veliyle session başlat",
          "Ödemeyi tamamen cüzdandan yap",
        ],
        passCriteria: "Wallet balance düşer; payments.wallet_amount = total",
      },
      {
        id: "extend",
        title: "Süre uzatma (+30 dk)",
        steps: [
          "Aktif bir session'da 'Süre uzat' butonuna bas",
          "30 dakika seç, ödeme yöntemi: Kart",
          "Onayla",
        ],
        passCriteria: "Geri sayım +30:00 atlar; session_extensions tablosunda kayıt; audit_logs 'session.extend'",
      },
      {
        id: "unlimited-convert",
        title: "Sınırsız'a geçiş",
        steps: [
          "Süreli bir session'da 'Sınırsız' butonuna bas",
          "Ödeme onayı ver",
        ],
        passCriteria: "Geri sayım ∞ olur; KPI 'Sınırsız' sayısı +1",
      },
      {
        id: "refund",
        title: "İade işlemi",
        steps: [
          "Aktif session'da 'İptal & İade' butonuna bas",
          "Sebep seç, notu yaz, onayla",
        ],
        passCriteria: "Veli cüzdanına kalan dakika kadar bakiye iade; refund_logs kaydı; audit warning",
      },
      {
        id: "session-end",
        title: "Session bitişi (manuel çıkış)",
        steps: [
          "Aktif session'da 'Çıkış yap' butonuna bas",
        ],
        passCriteria: "Aktif oyun listesinden düşer; 'X çıkış yaptı' bildirimi (success ton)",
      },
      {
        id: "dashboard-sync",
        title: "Dashboard realtime sync",
        steps: [
          "Dashboard'u aç",
          "Başka bir sekmede yeni session başlat",
        ],
        passCriteria: "Dashboard < 1 saniye içinde otomatik güncellenir (KPI + Live Operations + grafikler)",
      },
    ],
  },
  {
    id: "edge-cases",
    title: "Edge Case'ler",
    icon: AlertTriangle,
    tone: "amber",
    scenarios: [
      {
        id: "double-click",
        title: "Hızlı double-click (anti-duplicate)",
        steps: [
          "Ödeme butonuna art arda 5 kez bas",
        ],
        passCriteria: "DB'de tek payment kaydı; actionLock log'u (debug)",
      },
      {
        id: "duplicate-refund",
        title: "Çifte iade engeli",
        steps: [
          "Aynı session için 'İade' butonuna 2 farklı sekmeden bas",
        ],
        passCriteria: "İkinci çağrı 'Bu işlem zaten yürütülüyor' hatası verir; tek refund kaydı",
      },
      {
        id: "offline",
        title: "Internet kesintisi",
        steps: [
          "DevTools → Network → Offline",
          "5 saniye bekle",
          "Online'a geri al",
        ],
        passCriteria: "Üstte kırmızı 'İnternet yok' bandı; geri açınca otomatik resync (reconnect token bump)",
      },
      {
        id: "realtime-reconnect",
        title: "Realtime kopuş + reconnect",
        steps: [
          "DevTools → Network → throttle 'Slow 3G'",
          "30 saniye bekle, sonra normal'e al",
        ],
        passCriteria: "Amber 'Canlı bağlantı kesildi' bandı; reconnect sonrası session-store resync",
      },
      {
        id: "expired-timer",
        title: "Süre bitti — alert + sticky strip",
        steps: [
          "Bir session'ı 5 dakikadan az olacak şekilde başlat (veya 2 dk geriden başlat)",
          "Sırasıyla 10dk / 5dk / 0sn eşiklerinin geçmesini izle",
        ],
        passCriteria: "Her threshold için 1 bildirim (warning → critical); sağ alt sticky strip görünür",
      },
      {
        id: "stale-tab",
        title: "Tab uyuduktan sonra dönüş",
        steps: [
          "Sekmeyi 1 dakika gizli tut (başka sekmede çalış)",
          "Geri dön",
        ],
        passCriteria: "Otomatik resync (supervisor token bump); timer'lar gerçek zamanla senkron",
      },
    ],
  },
  {
    id: "financial",
    title: "Finansal Doğrulama",
    icon: DollarSign,
    tone: "emerald",
    scenarios: [
      {
        id: "cash-total",
        title: "Nakit toplamı doğru",
        steps: [
          "Gün boyunca 3 nakit ödeme: ₺100, ₺150, ₺50",
          "KPI 'Nakit' alanına bak",
        ],
        passCriteria: "Toplam = ₺300; ödeme dağılımı paneli %ile uyumlu",
      },
      {
        id: "split-totals",
        title: "Split toplam = brüt ciro",
        steps: [
          "5 farklı split ödeme yap",
          "KPI Net Ciro vs Nakit+Kart+Cüzdan toplamını karşılaştır",
        ],
        passCriteria: "Nakit + Kart + Cüzdan = Net Ciro (varsa iade düşülmüş)",
      },
      {
        id: "wallet-balance",
        title: "Wallet bakiye tutarlılığı",
        steps: [
          "Veliye ₺500 cüzdan yükle",
          "Aynı veliyle ₺200'lük cüzdan ödemesi yap",
        ],
        passCriteria: "Yeni bakiye = 500 - 200 = ₺300; wallet_transactions'da 2 kayıt",
      },
      {
        id: "refund-credits-wallet",
        title: "İade cüzdana yansır",
        steps: [
          "Yarıda kalan session'a iade işle",
          "Velinin cüzdan bakiyesine bak",
        ],
        passCriteria: "Kalan dakika oranında iade bakiyeye eklenmiş; refund_logs.refund_amount = bakiye artışı",
      },
    ],
  },
  {
    id: "roles",
    title: "Rol & Branch",
    icon: Shield,
    tone: "blue",
    scenarios: [
      {
        id: "cashier-limits",
        title: "Kasiyer kısıtları",
        steps: [
          "Kasiyer rolüyle login ol",
          "/raporlar veya /personeller'e gitmeye çalış",
        ],
        passCriteria: "RoleGuard redirect yapar; kasiyer sadece hizli-kayit + aktif-oyun + cuzdan erişir",
      },
      {
        id: "branch-isolation",
        title: "Branch isolation",
        steps: [
          "Şube A'da session oluştur",
          "Şube B kullanıcısıyla login ol",
        ],
        passCriteria: "Şube B kullanıcısı şube A'nın session'larını GÖREMEZ (RLS)",
      },
      {
        id: "super-admin-switch",
        title: "Süper admin şube geçişi",
        steps: [
          "Super_admin ile login ol",
          "Header'daki şube switcher'dan 'Tüm Şubeler' → 'Merkez Şube'ye geç",
        ],
        passCriteria: "Dashboard verisi anında re-scope eder; reconnect token bump",
      },
    ],
  },
  {
    id: "perf-stress",
    title: "Performans & Stres",
    icon: Activity,
    tone: "rose",
    scenarios: [
      {
        id: "many-sessions",
        title: "20+ aktif session",
        steps: [
          "Demo populate → activeSessions: 20",
          "Aktivite simülatörünü aç",
          "5 dakika izle",
        ],
        passCriteria: "Tablette akıcı; tick lag yok; dashboard < 1s yenilenme; CPU < %30",
      },
      {
        id: "realtime-flood",
        title: "Realtime event flood",
        steps: [
          "Simülatör + 2 sekmede aynı anda manuel işlemler",
        ],
        passCriteria: "Notification dedupe çalışır; ses overflow yok; UI takılma yok",
      },
      {
        id: "tv-screen",
        title: "TV ekranı sync (/tv)",
        steps: [
          "/tv rotasını ayrı bir cihazda aç",
          "Admin tarafından session/exit yap",
        ],
        passCriteria: "TV ekranı < 1s gecikmeyle güncellenir; çocuk eklemesi animasyonlu görünür",
      },
    ],
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "gkp:demo:scenarios"

function loadProgress(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveProgress(state: Record<string, boolean>) {
  if (typeof window === "undefined") return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* swallow */ }
}

const TONE: Record<ScenarioGroup["tone"], { icon: string; bar: string }> = {
  violet:  { icon: "text-violet-600 dark:text-violet-300",  bar: "bg-violet-500" },
  amber:   { icon: "text-amber-600 dark:text-amber-300",   bar: "bg-amber-500" },
  emerald: { icon: "text-emerald-600 dark:text-emerald-300", bar: "bg-emerald-500" },
  blue:    { icon: "text-blue-600 dark:text-blue-300",     bar: "bg-blue-500" },
  rose:    { icon: "text-rose-600 dark:text-rose-300",     bar: "bg-rose-500" },
}

export function TestScenarioChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => setDone(loadProgress()), [])

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      saveProgress(next)
      return next
    })
  }

  function reset() {
    if (!confirm("Tüm checklist sıfırlanacak. Emin misin?")) return
    setDone({})
    saveProgress({})
  }

  const totalCount  = GROUPS.reduce((s, g) => s + g.scenarios.length, 0)
  const doneCount   = Object.values(done).filter(Boolean).length
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">İlerleme</span>
            <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">{doneCount}/{totalCount}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          title="Tümünü sıfırla"
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Groups */}
      {GROUPS.map((group) => {
        const groupDone  = group.scenarios.filter((s) => done[s.id]).length
        const groupTotal = group.scenarios.length
        const tone = TONE[group.tone]
        return (
          <div key={group.id} className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-2">
              <group.icon className={cn("w-3.5 h-3.5", tone.icon)} />
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-700 dark:text-slate-200">{group.title}</span>
              <span className="ml-auto text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                {groupDone}/{groupTotal}
              </span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {group.scenarios.map((sc) => {
                const isDone = !!done[sc.id]
                const isExpanded = expanded === sc.id
                return (
                  <li key={sc.id}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : sc.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left"
                    >
                      <span
                        role="checkbox"
                        aria-checked={isDone}
                        onClick={(e) => { e.stopPropagation(); toggle(sc.id) }}
                        className="flex-shrink-0 cursor-pointer"
                      >
                        {isDone
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          : <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
                      </span>
                      <span className={cn(
                        "text-xs font-semibold flex-1 truncate",
                        isDone ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-200",
                      )}>
                        {sc.title}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="px-9 pb-3 pt-1 space-y-2 text-[11px]">
                        <div>
                          <p className="font-bold text-slate-600 dark:text-slate-400 mb-1">Adımlar:</p>
                          <ol className="list-decimal list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                            {sc.steps.map((s, i) => <li key={i}>{s}</li>)}
                          </ol>
                        </div>
                        <div className="rounded-md bg-emerald-500/5 border border-emerald-500/15 px-2 py-1.5">
                          <p className="font-bold text-emerald-700 dark:text-emerald-300 mb-0.5">Geçer kriter:</p>
                          <p className="text-emerald-700/80 dark:text-emerald-300/80">{sc.passCriteria}</p>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
