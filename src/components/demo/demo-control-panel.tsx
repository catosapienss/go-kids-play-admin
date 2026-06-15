"use client"

import { useState } from "react"
import {
  PlayCircle, PauseCircle, RefreshCw, Sparkles, Trash2, X,
  Beaker, Users, CreditCard, Clock, CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useDemoMode, shouldShowDemoTooling } from "@/lib/demo/demo-mode"
import { populateDemo, resetDemoData, DEFAULT_PROFILE, type GeneratorProfile } from "@/lib/demo/data-generator"
import { useAuth } from "@/contexts/auth-context"
import { TestScenarioChecklist } from "./test-scenario-checklist"

// ─── Demo Control Panel ──────────────────────────────────────────────────────
//
// Floating control surface — only visible in dev OR for super_admins when
// demo mode is enabled. Three sections:
//
//   1. Mode + simulator toggles
//   2. One-click "Populate demo" with adjustable profile + reset button
//   3. Operational test checklist (manual QA driver)

export function DemoControlPanel() {
  const { user } = useAuth()
  const { enabled, simulatorRunning, setEnabled, setSimulatorRunning } = useDemoMode()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [profile, setProfile] = useState<GeneratorProfile>(DEFAULT_PROFILE)
  const [view, setView] = useState<"controls" | "scenarios">("controls")

  // Visibility gate
  // Strict dev-only: demo tools never ship to production where they'd risk
  // generating fake data against a real branch. The seed/simulator architecture
  // remains in code so we can re-enable for staging, but the UI surface hides.
  if (process.env.NODE_ENV === "production") return null
  if (!shouldShowDemoTooling()) return null
  void user

  async function handlePopulate() {
    setBusy(true)
    setLastResult(null)
    try {
      const r = await populateDemo(profile)
      const msg = `${r.customers} veli · ${r.children} çocuk · ${r.sessions} oturum · ${r.payments} ödeme${r.organizations ? ` · ${r.organizations} org` : ""}`
      setLastResult(msg)
      toast.success("Demo verisi oluşturuldu", { description: msg })
    } catch (e) {
      toast.error("Demo populate başarısız", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    if (!confirm("Tüm demo verisi temizlenecek. Emin misin?")) return
    setBusy(true)
    try {
      const r = await resetDemoData()
      if (r.ok) toast.success(r.message)
      else toast.warning(r.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Demo control panel"
        className={cn(
          "fixed bottom-4 right-4 z-40 h-10 px-3 rounded-xl",
          "bg-gradient-to-r from-fuchsia-500 to-violet-600",
          "text-white text-xs font-bold flex items-center gap-2",
          "shadow-lg shadow-fuchsia-500/30",
          "hover:shadow-fuchsia-500/50 transition-all",
          open && "ring-2 ring-fuchsia-300",
        )}
      >
        <Beaker className="w-4 h-4" />
        Demo
        {enabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />}
      </button>

      {open && (
        <div className={cn(
          "fixed bottom-16 right-4 z-40 w-[380px] max-w-[calc(100vw-2rem)] max-h-[80vh]",
          "rounded-2xl border border-slate-200 dark:border-slate-700",
          "bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg",
          "shadow-2xl shadow-slate-900/20 dark:shadow-black/50",
          "overflow-hidden flex flex-col",
          "animate-[fadeInUp_140ms_ease-out]",
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Demo Kontrol Paneli</h3>
              <p className="text-[10px] text-slate-500">Operasyon simülasyonu · QA testleri</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <TabButton active={view === "controls"}   onClick={() => setView("controls")}>Kontroller</TabButton>
            <TabButton active={view === "scenarios"}  onClick={() => setView("scenarios")}>Senaryolar</TabButton>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {view === "controls" ? (
              <>
                {/* Mode toggles */}
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Demo Modu</p>
                      <p className="text-[10px] text-slate-500">UI'de DEMO etiketi + simülatör hazır</p>
                    </div>
                    <ToggleSwitch checked={enabled} onChange={setEnabled} />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Aktivite Simülatörü</p>
                      <p className="text-[10px] text-slate-500">Rastgele giriş/ödeme/çıkış</p>
                    </div>
                    <ToggleSwitch
                      checked={simulatorRunning}
                      onChange={setSimulatorRunning}
                      disabled={!enabled}
                    />
                  </div>
                </Card>

                {/* Data generator */}
                <Card>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">Veri Üretici</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <NumberField label="Müşteri" value={profile.customers}    onChange={(v) => setProfile({ ...profile, customers: v })} />
                    <NumberField label="Aktif Oyun" value={profile.activeSessions} onChange={(v) => setProfile({ ...profile, activeSessions: v })} />
                    <NumberField label="Ödeme" value={profile.recentPayments}  onChange={(v) => setProfile({ ...profile, recentPayments: v })} />
                    <NumberField label="Organizasyon" value={profile.organizations} onChange={(v) => setProfile({ ...profile, organizations: v })} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handlePopulate}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold"
                    >
                      {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Doldur
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleReset}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/15 disabled:opacity-50 text-rose-700 dark:text-rose-300 text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Temizle
                    </button>
                  </div>
                  {lastResult && (
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {lastResult}
                    </p>
                  )}
                </Card>

                {/* Quick stats */}
                <Card>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">Hızlı Aksiyonlar</p>
                  <div className="grid grid-cols-3 gap-2">
                    <QuickStat icon={Users}      label="Müşteri ekle" onClick={() => populateDemo({ customers: 3, activeSessions: 0, recentPayments: 0, organizations: 0 })} />
                    <QuickStat icon={Clock}      label="Oturum başlat" onClick={() => populateDemo({ customers: 0, activeSessions: 1, recentPayments: 0, organizations: 0 })} />
                    <QuickStat icon={CreditCard} label="Ödeme ekle"   onClick={() => populateDemo({ customers: 0, activeSessions: 0, recentPayments: 1, organizations: 0 })} />
                  </div>
                </Card>
              </>
            ) : (
              <TestScenarioChecklist />
            )}
          </div>

          <style jsx>{`
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(4px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </>
  )
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900/60 p-3">
      {children}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 text-xs font-bold py-2 transition-colors",
        active
          ? "text-violet-700 dark:text-violet-300 border-b-2 border-violet-500"
          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
      )}
    >
      {children}
    </button>
  )
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-10 h-6 rounded-full transition-colors",
        checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="number"
        min={0}
        max={200}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="mt-1 w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white"
      />
    </label>
  )
}

function QuickStat({ icon: Icon, label, onClick }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try { await onClick(); toast.success(label) }
        catch (e) { toast.error(e instanceof Error ? e.message : "Hata") }
        finally { setBusy(false) }
      }}
      className="flex flex-col items-center gap-1 p-2 rounded-lg border border-slate-200/70 dark:border-slate-700/70 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-50"
    >
      <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
      <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">{label}</span>
    </button>
  )
}

// Re-export for layout consumption
export { PlayCircle, PauseCircle }
