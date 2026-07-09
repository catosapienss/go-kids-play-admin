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
  "cash_register.close":     "Kasa Kapanışı",
  "staff.day.closing":       "Personel Gün Sonu",
  "session.start":           "Oturum Başlatma",
  "session.create":          "Oturum Açılışı",
  "session.end":             "Oturum Bitiş",
  "session.extend":          "Süre Uzatma",
  "session.convert_unlimited":"Sınırsıza Geçiş",
  "payment.create":          "Ödeme Alındı",
  "payment.refund":          "İade",
  "refund.cancel":           "İptal & İade",
  "membership.activate":     "Üyelik Aktivasyon",
  "membership.cancel":       "Üyelik İptal",
  "customer.create":         "Müşteri Kaydı",
  "hizli-kayit.cancel":      "Kayıt İptali (Hızlı Kayıt)",
  "discount.apply":          "İndirim Uygulandı",
  "retail.sale":             "Perakende Satış",
  "retail.void":             "Satış İptali",
  "retail.waste":            "Zayiat Kaydı",
  "retail.waste.delete":     "Zayiat Silindi",
  "wallet.load":             "Cüzdan Yükleme",
  "wallet.deduct":           "Cüzdan Kullanımı",
  "child.note.update":       "Çocuk Notu Güncellendi",
  "ops_note.create":         "Vardiya Notu Eklendi",
  "ops_note.delete":         "Vardiya Notu Silindi",
  "user.switch":             "Kullanıcı Değişimi",
  "user.switch.fail":        "Hatalı PIN Denemesi",
  "customer.tag.add":        "Müşteri Etiketi Eklendi",
  "customer.tag.remove":     "Müşteri Etiketi Kaldırıldı",
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

// Human labels for discount reasons (play + retail) so managers read the WHY,
// not a raw enum key.
const REASON_LABELS: Record<string, string> = {
  // play/session discount reasons
  customer_loyalty:  "Müşteri Sadakati",
  sibling_discount:  "Kardeş İndirimi",
  birthday_discount: "Doğum Günü İndirimi",
  manager_approval:  "Yönetici Onayı",
  special_campaign:  "Özel Kampanya",
  // retail discount reasons
  staff:             "Personel İndirimi",
  vip:               "VIP Müşteri",
  campaign:          "Kampanya",
  promotion:         "Promosyon",
  damaged:           "Hasarlı Paket",
  loyalty:           "Sadakat İndirimi",
  customer:          "Müşteri İndirimi",
  manual:            "Manuel Düzenleme",
  other:             "Diğer",
}
function reasonLabel(reason: string | null): string | null {
  if (!reason) return null
  return REASON_LABELS[reason] ?? reason
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Nakit", card: "Kart", wallet: "Cüzdan", free: "Ücretsiz", split: "Karma",
}
function methodLabel(m: string | null): string | null {
  if (!m) return null
  return METHOD_LABELS[m] ?? m
}

// ─── Meta value helpers ─────────────────────────────────────────────────────

function tl(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v)
  if (!isFinite(n)) return "₺0"
  return "₺" + n.toLocaleString("tr-TR")
}

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

function fmtTime(iso: unknown): string | null {
  if (typeof iso !== "string") return null
  try {
    return new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
  } catch {
    return null
  }
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

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 mr-3">
      <span className="text-slate-400">{label}:</span>
      <strong className={cn("text-slate-700 dark:text-slate-200", tone)}>{value}</strong>
    </span>
  )
}

function MetaDetail({ meta, action }: { meta: Record<string, unknown>; action: string }) {

  // ── Hızlı Kayıt İptali ────────────────────────────────────────────────
  if (action === "hizli-kayit.cancel") {
    const parent   = str(meta.parent_name)
    const phone    = str(meta.parent_phone)
    const kids     = Array.isArray(meta.child_names) ? (meta.child_names as string[]).filter(Boolean) : []
    const gross    = meta.gross_total
    const byWhom   = str(meta.cancelled_by)
    const when     = fmtTime(meta.cancelled_at)
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        {parent && <Row label="Veli" value={parent} />}
        {phone  && <Row label="Tel"  value={phone} />}
        {kids.length > 0 && <Row label={kids.length > 1 ? "Çocuklar" : "Çocuk"} value={kids.join(", ")} />}
        {typeof gross === "number" && gross > 0 && <Row label="Tutar" value={tl(gross)} tone="text-amber-600" />}
        {byWhom && <Row label="İptal Eden" value={byWhom} tone="text-rose-600" />}
        {when   && <Row label="Saat" value={when} />}
      </span>
    )
  }

  // ── Ödeme oluşturuldu ─────────────────────────────────────────────────
  if (action === "payment.create") {
    const cash   = Number(meta.cash   ?? 0)
    const card   = Number(meta.card   ?? 0)
    const wallet = Number(meta.wallet ?? 0)
    const total  = Number(meta.total  ?? cash + card + wallet)
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        {cash   > 0 && <Row label="Nakit"  value={tl(cash)}   tone="text-emerald-600" />}
        {card   > 0 && <Row label="Kart"   value={tl(card)}   tone="text-blue-600" />}
        {wallet > 0 && <Row label="Cüzdan" value={tl(wallet)} tone="text-violet-600" />}
        <Row label="Toplam" value={tl(total)} tone="text-slate-900 dark:text-white" />
      </span>
    )
  }

  // ── Oturum açılışı ────────────────────────────────────────────────────
  if (action === "session.create" || action === "session.start") {
    const child  = str(meta.childName) ?? str(meta.child_name)
    const parent = str(meta.parentName) ?? str(meta.parent_name)
    const staff  = str(meta.staffName) ?? str(meta.staff_name)
    // The recorder stores `durationMin` as the number of minutes OR the string
    // "unlimited". Read that FIRST (the old code only looked at duration_minutes
    // and so every row fell through to 0 → "Sınırsız", even 60-min sessions).
    const rawDur = meta.durationMin ?? meta.duration_minutes ?? meta.durationMinutes
    const isUnlimited = rawDur === "unlimited" || rawDur === 0 || rawDur === "0"
    const durNum = Number(rawDur)
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        {child  && <Row label="Çocuk" value={child} />}
        {parent && <Row label="Veli"  value={parent} />}
        {isUnlimited
          ? <Row label="Süre" value="Sınırsız" tone="text-fuchsia-600" />
          : isFinite(durNum) && durNum > 0
            ? <Row label="Süre" value={`${durNum} dk`} />
            : null}
        {staff  && <Row label="Personel" value={staff} tone="text-violet-600" />}
      </span>
    )
  }

  // ── Süre uzatma / Sınırsıza geçiş ─────────────────────────────────────
  if (action === "session.extend" || action === "session.convert_unlimited") {
    const minutesRaw = meta.minutes
    const amount = Number(meta.amount ?? 0)
    const method = methodLabel(str(meta.method))
    const isUnlimited =
      action === "session.convert_unlimited" ||
      minutesRaw == null || Number(minutesRaw) >= 9999
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        <Row
          label="İşlem"
          value={isUnlimited ? "Sınırsız pakete geçildi" : `+${Number(minutesRaw)} dk eklendi`}
          tone="text-emerald-600"
        />
        {amount > 0 && <Row label="Tutar" value={tl(amount)} tone="text-amber-600" />}
        {method && <Row label="Ödeme" value={method} />}
        {amount === 0 && <Row label="Ödeme" value="Ücretsiz" />}
      </span>
    )
  }

  // ── Perakende satış ───────────────────────────────────────────────────
  if (action === "retail.sale") {
    const items   = str(meta.items)
    const total   = Number(meta.total ?? 0)
    const cash    = Number(meta.cash ?? 0)
    const card    = Number(meta.card ?? 0)
    const disc    = Number(meta.discountTotal ?? 0)
    const reasons = Array.isArray(meta.discountReasons)
      ? (meta.discountReasons as string[]).map((r) => reasonLabel(r) ?? r)
      : []
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        {items && <Row label="Ürünler" value={items} />}
        {cash > 0 && <Row label="Nakit" value={tl(cash)} tone="text-emerald-600" />}
        {card > 0 && <Row label="Kart"  value={tl(card)} tone="text-blue-600" />}
        <Row label="Toplam" value={tl(total)} tone="text-slate-900 dark:text-white" />
        {disc > 0 && <Row label="İndirim" value={`−${tl(disc)}`} tone="text-amber-600" />}
        {reasons.length > 0 && <Row label="İndirim Sebebi" value={reasons.join(", ")} tone="text-amber-600" />}
      </span>
    )
  }

  // ── Zayiat (perakende fire/kayıp) ─────────────────────────────────────
  if (action === "retail.waste") {
    const product = str(meta.product)
    const quantity = Number(meta.quantity ?? 0)
    const cost = Number(meta.total_cost ?? 0)
    const reason = str(meta.reason)
    const note = str(meta.note)
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        {product && <Row label="Ürün" value={`${product}${quantity > 0 ? ` × ${quantity}` : ""}`} />}
        {reason && <Row label="Sebep" value={reason} tone="text-rose-600" />}
        {cost > 0 && <Row label="Kayıp" value={`−${tl(cost)}`} tone="text-rose-600" />}
        {note && <Row label="Not" value={note} />}
      </span>
    )
  }

  // ── Müşteri kaydı ─────────────────────────────────────────────────────
  if (action === "customer.create") {
    const name  = str(meta.fullName) ?? str(meta.full_name) ?? str(meta.name)
    const phone = str(meta.phone)
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        {name  && <Row label="Ad Soyad" value={name} />}
        {phone && <Row label="Telefon"  value={phone} />}
      </span>
    )
  }

  // ── İndirim uygulandı (oyun/seans) ────────────────────────────────────
  if (action === "discount.apply") {
    const type   = str(meta.type)
    const value  = Number(meta.value  ?? 0)
    const amount = Number(meta.amount ?? 0)
    const reason = reasonLabel(str(meta.reason))
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        <Row label={type === "percent" ? "Oran" : "İndirim"} value={type === "percent" ? `%${value}` : tl(value)} />
        <Row label="Tutar" value={`−${tl(amount)}`} tone="text-amber-600" />
        {reason && <Row label="Sebep" value={reason} tone="text-amber-600" />}
      </span>
    )
  }

  // ── Kullanıcı değişimi (lock-screen PIN switch) ───────────────────────
  if (action === "user.switch" || action === "user.switch.fail") {
    const from = str(meta.from)
    const to   = str(meta.to)
    const failPrefix = str(meta.attempted_pin_prefix)
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        {failPrefix && <Row label="Denenen PIN" value={failPrefix} tone="text-rose-600" />}
        {from && <Row label="Önceki" value={from.slice(0, 8) + "…"} />}
        {to   && <Row label="Yeni"   value={to.slice(0, 8) + "…"} tone="text-emerald-600" />}
      </span>
    )
  }

  // ── Personel gün sonu ────────────────────────────────────────────────
  if (action === "staff.day.closing") {
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        <Row label="Nakit" value={tl(meta.cash_count)} tone="text-emerald-600" />
        <Row label="POS"   value={tl(meta.pos_z_report)} tone="text-blue-600" />
        {!!meta.notes && <em className="not-italic text-slate-400">· {String(meta.notes)}</em>}
      </span>
    )
  }

  // ── Kasa kapanışı ─────────────────────────────────────────────────────
  if (action === "cash_register.close" && meta.diff) {
    const diff = meta.diff as Record<string, number>
    const total = diff.total ?? 0
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        <Row
          label="Fark"
          value={`${total >= 0 ? "+" : ""}${tl(total)}`}
          tone={Math.abs(total) < 0.01 ? "text-emerald-600" : "text-amber-600"}
        />
      </span>
    )
  }

  // ── Müşteri etiketi eklendi / kaldırıldı ──────────────────────────────
  if (action === "customer.tag.add" || action === "customer.tag.remove") {
    const tag = str(meta.tag)
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        {tag && <Row label="Etiket" value={tag} tone="text-violet-600" />}
      </span>
    )
  }

  // ── Fallback: pretty key-value list for unknown actions ───────────────
  const entries = Object.entries(meta).filter(([, v]) => v != null && v !== "" && v !== false)
  if (entries.length === 0) return <span className="text-slate-400 italic text-[11px]">detay yok</span>
  return (
    <span className="text-[12px] text-slate-500 dark:text-slate-400">
      {entries.slice(0, 4).map(([k, v]) => (
        <Row
          key={k}
          label={k.replace(/_/g, " ")}
          value={typeof v === "object" ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)}
        />
      ))}
      {entries.length > 4 && <span className="text-slate-400">+{entries.length - 4} daha</span>}
    </span>
  )
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
