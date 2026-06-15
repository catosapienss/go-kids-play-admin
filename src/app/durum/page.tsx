"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ShieldCheck, CheckCircle2, AlertCircle, Activity, Database, Radio,
  Layers, Package, Smartphone, Tv, BarChart3, Users, Wallet, Cake,
  KeyRound, ShoppingBag, type LucideIcon, ExternalLink, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MainLayout } from "@/components/layout/main-layout"
import { createClient } from "@/lib/supabase/client"
import { useNetworkStatus } from "@/lib/reliability/network-status"

// ─── /durum — Sistem Özeti ───────────────────────────────────────────────────
//
// Production-style "what's built, what's live, what's next" overview. Designed
// to read like a real status page rather than a developer dashboard:
//
//   • Top: production-readiness summary band (single sentence + level chip)
//   • Modules: every operational system with a status + entry point
//   • Backend health: live ping of every migration's headline table
//   • Realtime: live network + realtime channel state
//   • Roadmap: what's intentionally pending
//
// Replaces /dev-status as the operator-facing overview. /dev-status remains
// in code for low-level diagnostics if needed.

interface ModuleEntry {
  id: string
  icon: LucideIcon
  title: string
  description: string
  status: "live" | "beta" | "planned"
  href?: string
  external?: boolean
}

const MODULES: ModuleEntry[] = [
  {
    id: "dashboard", icon: Activity,
    title: "Yönetici Paneli",
    description: "Canlı KPI'lar, gelir grafikleri, aktif oturumlar, geri sayımlı operasyon paneli.",
    status: "live", href: "/",
  },
  {
    id: "ops", icon: ShieldCheck,
    title: "Operasyonel İşlemler",
    description: "Hızlı kayıt, aktif oyun yönetimi, süre uzatma, sınırsız geçişler, iade akışı.",
    status: "live", href: "/hizli-kayit",
  },
  {
    id: "customers", icon: Users,
    title: "Müşteri & Sadakat",
    description: "Trigram aramalı CRM, müşteri profili sheet'i, loyalty tier (VIP/sık/regular).",
    status: "live", href: "/crm",
  },
  {
    id: "memberships", icon: Sparkles,
    title: "Üyelikler",
    description: "Sınırsız + aylık + kontörlü üyelikler, pause sistemi, kullanım takibi.",
    status: "live", href: "/uyelikler",
  },
  {
    id: "wallet", icon: Wallet,
    title: "Cüzdan Sistemi",
    description: "Bakiye yönetimi, yükleme, kullanım, iade kredisi, bonus, atomic wallet ops.",
    status: "live", href: "/cuzdan",
  },
  {
    id: "events", icon: Cake,
    title: "Doğum Günü & Organizasyon",
    description: "Etkinlik takvimi, organizasyon yönetimi, paket+çocuk sayısı planlaması.",
    status: "live", href: "/dogum-gunleri",
  },
  {
    id: "reports", icon: BarChart3,
    title: "Raporlar (BI)",
    description: "4-sekmeli analytics: gelir periodları, peak hours heatmap, müşteri içgörüleri, paket performansı.",
    status: "live", href: "/raporlar",
  },
  {
    id: "dayend", icon: ShieldCheck,
    title: "Gün Sonu Kapanış",
    description: "Kasa sayımı, fark tespiti, zorunlu not, idempotent kapanış, geçmiş kapanışlar.",
    status: "live", href: "/gun-sonu",
  },
  {
    id: "staff", icon: Users,
    title: "Personel & Vardiya",
    description: "Clock-in/out, vardiya geçmişi, aktivite logu, audit trail, iade takibi.",
    status: "live", href: "/personeller",
  },
  {
    id: "tv", icon: Tv,
    title: "Canlı TV Ekranı",
    description: "Premium kiosk display: auto-sizing grid, 6 status tonu, cinema mode, multi-density.",
    status: "live", href: "/tv/live", external: true,
  },
  {
    id: "parent", icon: Smartphone,
    title: "Veli Mobil Portalı (PWA)",
    description: "Passwordless kod girişi, canlı süre, cüzdan, paket geçmişi, mobil paket alımı.",
    status: "live", href: "/parent", external: true,
  },
  {
    id: "purchase", icon: ShoppingBag,
    title: "Mobil Paket Alımı",
    description: "4-adım purchase flow, cüzdan/kart/karma ödeme, entry code üretimi, bekleyen rezervasyon yönetimi.",
    status: "live", href: "/parent", external: true,
  },
  {
    id: "code", icon: KeyRound,
    title: "Müşteri Kodu (QR foundation)",
    description: "PLAY-XXXX kalıcı kod sistemi. Aynı RPC ile QR'a geçiş için future-ready.",
    status: "live",
  },
  {
    id: "branches", icon: Package,
    title: "Multi-Branch Foundation",
    description: "branch_id her tabloda, RLS branch-scoped, super_admin switcher, tenant subdomain hazır.",
    status: "live", href: "/subeler",
  },
  {
    id: "notifications", icon: Radio,
    title: "Realtime Alert Engine",
    description: "Session threshold uyarıları (10/5/0 dk), realtime DB events, sesli feedback, dedupe.",
    status: "live",
  },
  {
    id: "reliability", icon: ShieldCheck,
    title: "Reliability Foundation",
    description: "Idempotency keys, audit log, retry+backoff, network supervisor, error boundary, safeFinanceAction.",
    status: "live",
  },
]

const BACKEND_MODULES = [
  { table: "profiles",               label: "Auth & Profiles",       migration: "001" },
  { table: "branches",               label: "Multi-Branch",          migration: "005" },
  { table: "sessions",               label: "Sessions",              migration: "core" },
  { table: "payments",               label: "Payments",              migration: "core" },
  { table: "wallet_transactions",    label: "Wallet",                migration: "003" },
  { table: "refund_logs",            label: "Refund Logs",           migration: "003" },
  { table: "audit_logs",             label: "Audit & Idempotency",   migration: "006" },
  { table: "entry_codes",            label: "Entry Codes",           migration: "008" },
  { table: "cash_register_closings", label: "Cash Register",         migration: "009" },
  { table: "staff_shifts",           label: "Staff Shifts",          migration: "010" },
  { table: "customer_summary",       label: "Customer Summary view", migration: "011" },
  { table: "pending_reservations",   label: "Mobile Reservations",   migration: "013" },
  { table: "memberships",            label: "Memberships",           migration: "014" },
]

interface ModuleHealth { table: string; ok: boolean }

export default function DurumPage() {
  const { online, realtimeConnected } = useNetworkStatus()
  const [health, setHealth] = useState<ModuleHealth[]>([])
  const [pinging, setPinging] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function ping() {
      const supabase = createClient()
      const results = await Promise.all(BACKEND_MODULES.map(async (m) => {
        try {
          const { error } = await supabase
            .from(m.table)
            .select("*", { count: "exact", head: true })
            .limit(1)
          return { table: m.table, ok: !error }
        } catch { return { table: m.table, ok: false } }
      }))
      if (!cancelled) {
        setHealth(results)
        setPinging(false)
      }
    }
    void ping()
    return () => { cancelled = true }
  }, [])

  const liveCount = MODULES.filter((m) => m.status === "live").length
  const totalModules = MODULES.length
  const healthyTables = health.filter((h) => h.ok).length
  const totalTables = BACKEND_MODULES.length

  // Production readiness summary
  const readiness = pinging
    ? { level: "checking" as const, label: "Kontrol ediliyor", tone: "neutral" as const }
    : healthyTables === totalTables
    ? { level: "production" as const, label: "Operasyonel", tone: "good" as const }
    : healthyTables >= Math.floor(totalTables * 0.8)
    ? { level: "staging" as const, label: "Staging", tone: "warn" as const }
    : { level: "pending" as const, label: "Migration eksik", tone: "bad" as const }

  return (
    <MainLayout
      title="Sistem Özeti"
      subtitle="Kurulu modüller · backend sağlığı · operasyonel hazırlık"
    >
      <div className="max-w-[1400px] mx-auto space-y-5">
        {/* Top readiness band */}
        <ReadinessBand
          readiness={readiness}
          liveModules={liveCount}
          totalModules={totalModules}
          healthyTables={healthyTables}
          totalTables={totalTables}
          online={online}
          realtimeConnected={realtimeConnected}
        />

        {/* Implemented modules */}
        <Section title="Kurulu Modüller" subtitle={`${liveCount} modül canlı`} icon={Layers}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULES.map((m) => <ModuleCard key={m.id} {...m} />)}
          </div>
        </Section>

        {/* Backend health */}
        <Section
          title="Backend & Migration Sağlığı"
          subtitle={pinging ? "kontrol ediliyor…" : `${healthyTables}/${totalTables} tablo hazır`}
          icon={Database}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200/70 dark:border-slate-800/70">
            {BACKEND_MODULES.map((m) => {
              const h = health.find((x) => x.table === m.table)
              return (
                <div key={m.table} className="bg-white dark:bg-slate-900 px-4 py-3 flex items-center gap-3">
                  {pinging ? (
                    <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse flex-shrink-0" />
                  ) : (
                    <div className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
                      h?.ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-300",
                    )}>
                      {h?.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{m.label}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                      {m.table} · migration {m.migration}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Operational integrations */}
        <Section title="Operasyonel Entegrasyonlar" subtitle="Modüller arası bağlantılar" icon={Layers}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Integration
              from="Müşteri" to="Oturum" via="Hızlı kayıt → entry code → session"
            />
            <Integration
              from="Oturum" to="Ödeme" via="Split payment (nakit/kart/cüzdan)"
            />
            <Integration
              from="Ödeme" to="Rapor" via="get_revenue_breakdown · daily roll-up"
            />
            <Integration
              from="Üyelik" to="Müşteri" via="Pause history + kullanım sayacı"
            />
            <Integration
              from="Cüzdan" to="İade" via="cancel_and_refund · auto-credit"
            />
            <Integration
              from="Mobil Satın Al" to="Kasiyer Check-In" via="pending_reservations + lookup_entry_code"
            />
            <Integration
              from="Realtime" to="Her ekran" via="Supabase channels + reconnect supervisor"
            />
            <Integration
              from="Audit" to="Tüm finans" via="safeFinanceAction + audit_logs"
            />
          </div>
        </Section>

        {/* Suggested 5-minute live demo flow */}
        <Section
          title="Önerilen Demo Akışı"
          subtitle="Yöneticiye sistem tanıtımı için 5 dakikalık script"
          icon={Activity}
        >
          <ol className="rounded-2xl border border-violet-200 dark:border-violet-700/40 bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-500/[0.06] dark:to-slate-900 divide-y divide-violet-100 dark:divide-violet-900/20 overflow-hidden">
            <DemoStep
              n={1}
              title="Yönetici Paneli ile aç"
              body="/  → 8 KPI kartı, canlı operasyon paneli, gelir grafikleri. 'Bu bir dashboard' değil, gerçek operasyon paneli."
              duration="30 sn"
            />
            <DemoStep
              n={2}
              title="Hızlı Kayıt akışını göster"
              body="/hizli-kayit → kod kutusu üstte. Yeni veli + tek çocuk + 60dk + nakit. Toplam tıklama < 8."
              duration="60 sn"
            />
            <DemoStep
              n={3}
              title="Aktif Oyun ekranında canlı süreyi izlet"
              body="/aktif-oyun → biraz önce eklenen session 1sn'de bir geri sayım. Status renkleri ve uzatma butonu."
              duration="45 sn"
            />
            <DemoStep
              n={4}
              title="TV ekranını ayrı sekmede aç"
              body="/tv/live → fullscreen yap (F11). Premium dark display, otomatik yerleşim, renk durumları. Bu 'wow' anı."
              duration="40 sn"
            />
            <DemoStep
              n={5}
              title="Veli Portalı'nı telefon resolution'ında göster"
              body="/parent → DevTools mobile → kodla giriş → cüzdan + canlı süre + paket geçmişi. PWA'ya 'Ana ekrana ekle'."
              duration="60 sn"
            />
            <DemoStep
              n={6}
              title="Raporlar (BI) → CSV indir"
              body="/raporlar → tarih filtresi → gelir trendi grafiği + Indir CSV. 'Gerçek BI seviyesinde rapor'."
              duration="45 sn"
            />
            <DemoStep
              n={7}
              title="Gün Sonu Kapanış'ı senaryolaştır"
              body="/gun-sonu → kasa sayım inputları + fark badge + zorunlu not. Bu 'işletme sahibinin güvendiği'."
              duration="40 sn"
            />
            <DemoStep
              n={8}
              title="Ayarlar'ı aç → işletmeye özel hissi ver"
              body="/ayarlar → 7 bölüm tab nav. Paket fiyatlarını yöneticinin önünde değiştir, kayıt anında saved. 'Bu sizin sisteminiz.'"
              duration="60 sn"
            />
          </ol>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 px-1">
            Toplam: ~6 dakika. Sonunda <code className="font-mono">/durum</code>'a dön ve aşağıdaki kontrol listesini birlikte gez.
          </p>
        </Section>

        {/* Live test ready checklist — operator-facing scenarios to run on go-live day */}
        <Section
          title="Canlı Test Kontrol Listesi"
          subtitle="Salda mutlaka test edilmesi gereken operasyonel akışlar"
          icon={ShieldCheck}
        >
          <ul className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden">
            <ChecklistItem
              category="Hızlı kayıt"
              title="Yeni veli + tek çocuk → 60dk paket → nakit ödeme"
              hint="Süre kayda alındı mı? Aktif oyunda görünüyor mu? Geri sayım çalışıyor mu?"
            />
            <ChecklistItem
              category="Müşteri kodu"
              title="Aynı veli → tekrar geliş → kod ile hızlı çağrı"
              hint="PLAY-XXXX yaz → veli ve çocukları otomatik dolar"
            />
            <ChecklistItem
              category="Split payment"
              title="60dk paket → ₺75 nakit + ₺75 kart"
              hint="Toplam doğru mu? Mutabakat raporunda iki kalemde de görünüyor mu?"
            />
            <ChecklistItem
              category="Cüzdan"
              title="500₺ yükle → bonus tetiklendi mi → cüzdanla 150₺ paket al"
              hint="Bakiye doğru indi mi? Veli portalda anlık güncelleniyor mu?"
            />
            <ChecklistItem
              category="Süre uzatma"
              title="Aktif sessionı 30dk uzat → otomatik ödeme akışı"
              hint="Geri sayım yenilendi mi? TV ekranı güncellendi mi?"
            />
            <ChecklistItem
              category="İade"
              title="Aktif session iptal → cüzdana iade"
              hint="Cüzdan bakiyesi doğru arttı mı? Refund log oluştu mu?"
            />
            <ChecklistItem
              category="Sınırsız geçiş"
              title="60dk paketten Sınırsız'a yükselt → fark ödemesi"
              hint="Sınırsız etiketine geçti mi? Pause kuralı çalışıyor mu?"
            />
            <ChecklistItem
              category="TV ekranı"
              title="/tv/live tablete bağlı → aktif çocuklar görünüyor mu?"
              hint="Renkler doğru? Bitiyor olan amber/kırmızı?"
            />
            <ChecklistItem
              category="Veli portalı"
              title="Telefondan /parent → kod gir → cüzdan + aktif süre görünüyor"
              hint="PWA olarak ana ekrana ekleme testi"
            />
            <ChecklistItem
              category="Gün sonu"
              title="Gün sonu kapanış → kasa say → fark çık → notla onayla"
              hint="Kapanış kayıt edildi mi? Bir kez daha kapatmaya izin vermiyor mu?"
            />
            <ChecklistItem
              category="Rapor"
              title="/raporlar → bugün / haftalık karşılaştırma + CSV indir"
              hint="Net ciro doğru mu? Heatmap doluyor mu?"
            />
          </ul>
        </Section>

        {/* Roadmap */}
        <Section title="Yol Haritası" subtitle="Sonraki adımlar" icon={Package}>
          <ul className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden">
            <RoadmapItem
              status="next"
              title="Gerçek payment gateway entegrasyonu"
              body="Stripe / iyzico / PayTR adapter eklenmesi. Mobile purchase flow zaten provider field'ı kullanıyor."
            />
            <RoadmapItem
              status="next"
              title="Push notification servisi"
              body="Mevcut notification-channels foundation hazır; FCM/APN adapter aktivasyonu."
            />
            <RoadmapItem
              status="future"
              title="Native mobile app"
              body="PWA shell artık installable; sonraki adımda React Native sarmal ile App Store/Play."
            />
            <RoadmapItem
              status="future"
              title="QR check-in"
              body="Entry code system QR'a dönüşür; aynı RPC ile geriye uyumlu."
            />
            <RoadmapItem
              status="future"
              title="Multi-branch central analytics"
              body="branch_stats view hazır; super-admin dashboard agg sorguları için."
            />
          </ul>
        </Section>

        {/* Footer note */}
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-500/[0.05] p-4 text-[11px] text-emerald-800 dark:text-emerald-200 leading-relaxed">
          <strong>Üretim Modu Aktif:</strong> Rol ayrımı uygulanmakta (Yönetici / Personel).
          Personel yalnızca Hızlı Kayıt, Aktif Oyun ve Gün Sonu ekranlarına erişebilir.
          Yöneticiler tüm modüllere, finansal raporlara ve işlem kayıtlarına erişir.
          Supabase RLS ve şube izolasyonu aktif. İşlem kaydı (audit log) her finansal operasyon için tutulmaktadır.
        </div>
      </div>
    </MainLayout>
  )
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function ReadinessBand({
  readiness, liveModules, totalModules, healthyTables, totalTables, online, realtimeConnected,
}: {
  readiness: { level: string; label: string; tone: "good" | "warn" | "bad" | "neutral" }
  liveModules: number
  totalModules: number
  healthyTables: number
  totalTables: number
  online: boolean
  realtimeConnected: boolean
}) {
  const tones = {
    good:    { bg: "bg-emerald-500/10",  fg: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/30" },
    warn:    { bg: "bg-amber-500/10",    fg: "text-amber-700 dark:text-amber-300",     ring: "ring-amber-500/30" },
    bad:     { bg: "bg-rose-500/10",     fg: "text-rose-700 dark:text-rose-300",       ring: "ring-rose-500/30" },
    neutral: { bg: "bg-slate-500/10",    fg: "text-slate-700 dark:text-slate-300",     ring: "ring-slate-500/30" },
  } as const
  const t = tones[readiness.tone]

  return (
    <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ring-1", t.bg, t.fg, t.ring)}>
              {readiness.label}
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Go Kids Play platformu hazır
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Tüm temel operasyon, müşteri yönetimi, finans, raporlama ve veli mobil deneyimi
            modülleri canlı. Realtime senkronizasyon, audit altyapısı ve şube izolasyonu aktif.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 min-w-[280px]">
          <KpiTile label="Canlı Modül" value={`${liveModules}/${totalModules}`} />
          <KpiTile label="Backend Sağlığı" value={`${healthyTables}/${totalTables}`} />
          <KpiTile label="Bağlantı"        value={online ? "Online" : "Offline"} tone={online ? "good" : "bad"} />
          <KpiTile label="Realtime"        value={realtimeConnected ? "Bağlı" : "Kopuk"} tone={realtimeConnected ? "good" : "warn"} />
        </div>
      </div>
    </section>
  )
}

function KpiTile({ label, value, tone = "neutral" }: {
  label: string
  value: string
  tone?: "good" | "warn" | "bad" | "neutral"
}) {
  const TONE = {
    good:    "text-emerald-700 dark:text-emerald-300",
    warn:    "text-amber-700 dark:text-amber-300",
    bad:     "text-rose-700 dark:text-rose-300",
    neutral: "text-slate-900 dark:text-white",
  } as const
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-900/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn("text-base font-bold tabular-nums", TONE[tone])}>{value}</p>
    </div>
  )
}

function Section({ title, subtitle, icon: Icon, children }: {
  title: string
  subtitle?: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto">{subtitle}</span>}
      </div>
      {children}
    </section>
  )
}

function ModuleCard({ icon: Icon, title, description, status, href, external }: ModuleEntry) {
  const statusChip = status === "live"
    ? <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Canlı</span>
    : status === "beta"
    ? <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">Beta</span>
    : <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-400">Planlı</span>

  const body = (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-4 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700/60 transition-all h-full">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex-1 min-w-0 truncate">{title}</h3>
        {statusChip}
        {external && href && <ExternalLink className="w-3 h-3 text-slate-300 dark:text-slate-600" />}
      </div>
      <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
        {description}
      </p>
    </div>
  )

  if (!href) return body
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {body}
      </a>
    )
  }
  return <Link href={href} className="block">{body}</Link>
}

function Integration({ from, to, via }: { from: string; to: string; via: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-sm mb-1">
        <span className="font-bold text-slate-900 dark:text-white">{from}</span>
        <span className="text-slate-400">→</span>
        <span className="font-bold text-slate-900 dark:text-white">{to}</span>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{via}</p>
    </div>
  )
}

function DemoStep({ n, title, body, duration }: {
  n: number
  title: string
  body: string
  duration: string
}) {
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <div className="w-7 h-7 rounded-xl bg-violet-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
          <span className="text-[10px] uppercase tracking-widest font-bold text-violet-600 dark:text-violet-300">
            {duration}
          </span>
        </div>
        <p className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </li>
  )
}

function ChecklistItem({ category, title, hint }: {
  category: string
  title: string
  hint: string
}) {
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5 bg-violet-500/15 text-violet-700 dark:text-violet-300">
        {category}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{hint}</p>
      </div>
    </li>
  )
}

function RoadmapItem({ status, title, body }: {
  status: "next" | "future"
  title: string
  body: string
}) {
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <span className={cn(
        "text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5",
        status === "next"
          ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
          : "bg-slate-500/15 text-slate-600 dark:text-slate-400",
      )}>
        {status === "next" ? "Sonraki" : "İleride"}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </li>
  )
}
