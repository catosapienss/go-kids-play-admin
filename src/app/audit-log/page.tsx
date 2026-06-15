"use client"

import { useEffect, useState, useCallback } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { createClient } from "@/lib/supabase/client"
import { Loader2, RefreshCw, Shield, AlertTriangle, Info, Search } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Audit Log Page — manager+ only ──────────────────────────────────────────

interface AuditRow {
  id: string
  action: string
  severity: "info" | "warning" | "error"
  entity_type: string | null
  entity_id: string | null
  meta: Record<string, unknown>
  request_id: string | null
  created_at: string
  user_id: string | null
  // joined from profiles via view or separate query
  user_name?: string
}

const ACTION_LABELS: Record<string, string> = {
  "cash_register.close":  "Kasa Kapanışı",
  "staff.day.closing":    "Personel Gün Sonu",
  "session.start":        "Oturum Başlatma",
  "session.end":          "Oturum Bitiş",
  "session.extend":       "Süre Uzatma",
  "payment.create":       "Ödeme",
  "payment.refund":       "İade",
  "membership.activate":  "Üyelik Aktivasyon",
  "membership.cancel":    "Üyelik İptal",
  "customer.create":      "Müşteri Kaydı",
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
      severity === "error"   && "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
      severity === "warning" && "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      severity === "info"    && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    )}>
      {severity === "error"   && <AlertTriangle className="w-2.5 h-2.5" />}
      {severity === "warning" && <AlertTriangle className="w-2.5 h-2.5" />}
      {severity === "info"    && <Info className="w-2.5 h-2.5" />}
      {severity}
    </span>
  )
}

function MetaDetail({ meta, action }: { meta: Record<string, unknown>; action: string }) {
  if (action === "staff.day.closing") {
    return (
      <span className="text-slate-500 dark:text-slate-400">
        Nakit: <strong className="text-slate-700 dark:text-slate-200">₺{Number(meta.cash_count ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</strong>
        {" · "}
        POS: <strong className="text-slate-700 dark:text-slate-200">₺{Number(meta.pos_z_report ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</strong>
        {!!meta.notes && <> · <em className="not-italic text-slate-400">{String(meta.notes)}</em></>}
      </span>
    )
  }
  if (action === "cash_register.close" && meta.diff) {
    const diff = meta.diff as Record<string, number>
    const total = (diff.total ?? 0)
    return (
      <span className="text-slate-500 dark:text-slate-400">
        Fark: <strong className={cn(Math.abs(total) < 0.01 ? "text-emerald-600" : "text-amber-600")}>
          {total >= 0 ? "+" : ""}₺{total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
        </strong>
      </span>
    )
  }
  const str = JSON.stringify(meta)
  return <span className="text-slate-400 font-mono text-[11px] truncate max-w-xs">{str.length > 80 ? str.slice(0, 80) + "…" : str}</span>
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200)

      if (error) throw error
      setRows((data ?? []) as AuditRow[])
    } catch (e) {
      console.error("audit log load failed", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = search.trim()
    ? rows.filter((r) =>
        r.action.includes(search) ||
        (r.entity_type ?? "").includes(search) ||
        JSON.stringify(r.meta).toLowerCase().includes(search.toLowerCase())
      )
    : rows

  return (
    <MainLayout title="İşlem Kayıtları" subtitle="Audit log · tüm operasyonlar">
      <div className="space-y-4 max-w-[1400px] mx-auto">

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İşlem ara…"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Yenile
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Shield className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Kayıt bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Zaman</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Durum</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">İşlem</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Varlık</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString("tr-TR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={row.severity} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {actionLabel(row.action)}
                        {row.action === "staff.day.closing" && !!row.meta?.submitted_by && (
                          <span className="ml-2 text-[11px] font-normal text-slate-400">
                            {String(row.meta.submitted_by)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-400">
                        {row.entity_type && (
                          <span className="font-mono">{row.entity_type}{row.entity_id ? `:${row.entity_id.slice(0, 8)}` : ""}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <MetaDetail meta={row.meta} action={row.action} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-[11px] text-slate-400 text-right">{filtered.length} kayıt · son 200</p>
        )}
      </div>
    </MainLayout>
  )
}
