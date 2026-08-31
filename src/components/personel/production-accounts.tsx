"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  CheckCircle2, XCircle, Loader2, Lock, RotateCcw, Shield,
  ChevronDown, AlertCircle, KeyRound, UserCheck, UserX,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import {
  MODULE_LABELS, ROLE_LABELS, ROLE_COLORS,
} from "@/types/auth"
import type { ModuleKey, PermissionOverrides, UserRole } from "@/types/auth"
import { DEFAULT_MODULE_ACCESS, compactOverrides } from "@/lib/permissions"

// ─── Production account management ───────────────────────────────────────────
//
// Split into two tabs so the everyday view answers "who works here":
//
//   Aktif Personel            — current employees
//   Ayrılan / Pasif Personel  — archived accounts, kept forever
//
// Admin can change role, grant/revoke any module, reset the PIN via
// admin_set_pin, and archive/restore an employee via admin_archive_staff /
// admin_restore_staff (migration 041).
//
// Archiving is NOT deletion. The profile row is what every historical
// session, sale, discount, closing and audit entry resolves a name through,
// so it stays; only the ability to sign in, unlock with a PIN and transact is
// withdrawn.
//
// Password reset + new-user creation require the Supabase service_role key
// and aren't possible from the client; flagged inline with a help note.

interface AccountRow {
  id: string
  username: string | null
  fullName: string | null
  role: UserRole
  permissions: PermissionOverrides
  lastLoginAt: string | null
  disabled: boolean
  isActive: boolean
  /** Set when the person left the business. Null = still employed. */
  leftAt: string | null
  archivedReason: string | null
}

/**
 * An archived account keeps its profile row — every historical session,
 * closing and report resolves the person's name through it — but can no
 * longer sign in, unlock with a PIN, or transact. See migration 041.
 */
function isArchivedRow(r: AccountRow): boolean {
  // Matches the auth-context guard exactly — `disabled` + `left_at`, never
  // `is_active` (see the note there). Keeping the two in step is what makes
  // "shown under Ayrılan" and "cannot log in" the same statement.
  return r.disabled || r.leftAt !== null
}

type Tab = "active" | "former"

const MODULE_ORDER: ModuleKey[] = [
  "dashboard", "customers", "memberships", "wallet", "birthdays",
  "reports", "finance", "retail", "staff", "settings", "tv",
]

const ROLE_OPTIONS: UserRole[] = ["super_admin", "admin", "manager", "staff"]

export function ProductionAccounts() {
  const { user: me } = useAuth()
  const [rows, setRows] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("active")

  const isAdmin = me?.role === "admin" || me?.role === "super_admin"

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    const supabase = createClient()

    const BASE = "id, username, full_name, role, permissions, last_login_at, disabled, is_active"

    // `left_at` / `archived_reason` arrive with migration 041. Until it is
    // applied the query is retried without them and the older disabled /
    // is_active flags carry the meaning on their own.
    // Both shapes are read through the same erased row type — the fallback
    // simply returns fewer keys, and every key is read defensively below.
    type Res = {
      data: Array<Record<string, unknown>> | null
      error: { code?: string; message: string } | null
    }

    const query = (cols: string) =>
      supabase
        .from("profiles")
        .select(cols)
        .order("role", { ascending: true })
        .order("username", { ascending: true })

    let res = (await query(`${BASE}, left_at, archived_reason`)) as unknown as Res

    const missingLifecycleCols =
      res.error?.code === "42703" || (res.error?.message ?? "").includes("left_at")

    if (missingLifecycleCols) {
      res = (await query(BASE)) as unknown as Res
    }

    if (res.error) {
      setError(res.error.message)
      setLoading(false)
      return
    }

    setRows(
      (res.data ?? []).map((r) => ({
        id: r.id as string,
        username: (r.username as string | null) ?? null,
        fullName: (r.full_name as string | null) ?? null,
        role: (r.role as UserRole) ?? "staff",
        permissions: (r.permissions as PermissionOverrides | null) ?? {},
        lastLoginAt: (r.last_login_at as string | null) ?? null,
        disabled: (r.disabled as boolean | null) ?? false,
        isActive: (r.is_active as boolean | null) ?? true,
        leftAt: (r.left_at as string | null) ?? null,
        archivedReason: (r.archived_reason as string | null) ?? null,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => { void reload() }, [reload])

  // Former employees are kept out of the default list so the day-to-day view
  // shows who actually works here. They are never removed — their accounts
  // and every record attached to them stay exactly where they are.
  const activeRows = rows.filter((r) => !isArchivedRow(r))
  const formerRows = rows.filter((r) => isArchivedRow(r))
  const shown = tab === "active" ? activeRows : formerRows

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/[0.06] p-6 text-sm text-amber-700 dark:text-amber-200">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        Bu ekran sadece yöneticiler içindir.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Hesap Yönetimi</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Rol, izin ve PIN ayarlarını buradan yönet. Yeni kullanıcı oluşturma ve şifre
            sıfırlama Supabase Dashboard üzerinden yapılır.
          </p>
        </div>
        <button
          onClick={() => void reload()}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Yenile
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="flex items-center gap-1.5">
          <TabChip
            label="Aktif Personel"
            count={activeRows.length}
            selected={tab === "active"}
            tone="active"
            onClick={() => { setTab("active"); setExpandedId(null) }}
          />
          <TabChip
            label="Ayrılan / Pasif Personel"
            count={formerRows.length}
            selected={tab === "former"}
            tone="former"
            onClick={() => { setTab("former"); setExpandedId(null) }}
          />
        </div>
      )}

      {!loading && !error && shown.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500">
          {tab === "active" ? "Aktif personel yok." : "Ayrılan personel yok."}
        </div>
      )}

      {tab === "former" && shown.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
          Bu hesaplar giriş yapamaz, PIN ile oturum açamaz ve işlem oluşturamaz.
          Geçmiş satış, oturum, rapor ve gün sonu kayıtlarında isimleri
          değişmeden görünmeye devam eder.
        </p>
      )}

      <div className="space-y-2">
        {shown.map((row) => (
          <AccountCard
            key={row.id}
            row={row}
            expanded={expandedId === row.id}
            onToggle={() => setExpandedId((id) => (id === row.id ? null : row.id))}
            onChanged={reload}
            isSelf={me?.id === row.id}
          />
        ))}
      </div>
    </div>
  )
}

function fmtDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })
  } catch { return iso }
}

// ─── Tab chip ────────────────────────────────────────────────────────────────

function TabChip({
  label, count, selected, tone, onClick,
}: {
  label: string
  count: number
  selected: boolean
  tone: "active" | "former"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors",
        selected
          ? tone === "active"
            ? "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50",
      )}
    >
      {tone === "active" ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
      {label}
      <span className="tabular-nums opacity-60">{count}</span>
    </button>
  )
}

// ─── Per-row card ────────────────────────────────────────────────────────────

function AccountCard({
  row, expanded, onToggle, onChanged, isSelf,
}: {
  row: AccountRow
  expanded: boolean
  onToggle: () => void
  onChanged: () => void | Promise<void>
  isSelf: boolean
}) {
  const lastLogin = row.lastLoginAt
    ? new Date(row.lastLoginAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })
    : "—"

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white dark:bg-slate-900 transition-colors",
        isArchivedRow(row)
          ? "border-slate-200 dark:border-slate-800 opacity-75"
          : "border-slate-200 dark:border-slate-800",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3 text-left"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {(row.fullName ?? row.username ?? "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {row.fullName || row.username || "İsimsiz"}
            </p>
            {isSelf && (
              <span className="text-[10px] font-bold text-violet-500">Siz</span>
            )}
            {isArchivedRow(row) && (
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                {row.leftAt ? "Ayrıldı" : "Devre dışı"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            <span className="font-mono">{row.username ?? "—"}</span>
            <span className="mx-2 opacity-40">·</span>
            <span>Son giriş: {lastLogin}</span>
            {row.leftAt && (
              <>
                <span className="mx-2 opacity-40">·</span>
                <span>Ayrılış: {fmtDay(row.leftAt)}</span>
              </>
            )}
          </p>
        </div>
        <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full", ROLE_COLORS[row.role])}>
          {ROLE_LABELS[row.role]}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-5">
          {row.archivedReason && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              {row.archivedReason}
            </p>
          )}
          <RoleEditor row={row} onChanged={onChanged} disabled={isSelf} />
          <PermissionsEditor row={row} onChanged={onChanged} />
          <PinResetRow row={row} onChanged={onChanged} />
          <ArchiveRow row={row} onChanged={onChanged} disabled={isSelf} />
        </div>
      )}
    </div>
  )
}

// ─── Role editor ─────────────────────────────────────────────────────────────

function RoleEditor({
  row, onChanged, disabled,
}: { row: AccountRow; onChanged: () => void | Promise<void>; disabled: boolean }) {
  const [saving, setSaving] = useState(false)

  async function update(role: UserRole) {
    if (role === row.role) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("profiles").update({ role }).eq("id", row.id)
    setSaving(false)
    if (error) {
      toast.error("Rol güncellenemedi: " + error.message.slice(0, 100))
      return
    }
    toast.success(`Rol "${ROLE_LABELS[role]}" olarak güncellendi`)
    await onChanged()
  }

  return (
    <div className="flex items-center gap-3">
      <Shield className="w-4 h-4 text-slate-400" />
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rol</span>
      <div className="flex flex-wrap gap-1.5 ml-auto">
        {ROLE_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => void update(r)}
            disabled={saving || disabled}
            className={cn(
              "text-[11px] font-bold px-2.5 py-1 rounded-full transition-all",
              row.role === r
                ? ROLE_COLORS[r] + " ring-2 ring-violet-400/60"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700",
              (saving || disabled) && "opacity-50 cursor-not-allowed",
            )}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
      {disabled && (
        <span className="text-[10px] text-slate-400">Kendi rolünü değiştiremezsin</span>
      )}
    </div>
  )
}

// ─── Permissions editor ──────────────────────────────────────────────────────

function PermissionsEditor({
  row, onChanged,
}: { row: AccountRow; onChanged: () => void | Promise<void> }) {
  const [saving, setSaving] = useState<ModuleKey | null>(null)

  const effective = (key: ModuleKey): boolean => {
    const override = row.permissions[key]
    if (typeof override === "boolean") return override
    return DEFAULT_MODULE_ACCESS[row.role][key]
  }

  async function toggle(key: ModuleKey) {
    setSaving(key)
    const next: PermissionOverrides = { ...row.permissions }
    const roleDefault = DEFAULT_MODULE_ACCESS[row.role][key]
    const current = effective(key)
    const desired = !current

    if (desired === roleDefault) {
      delete next[key] // remove override → fall back to role default
    } else {
      next[key] = desired
    }

    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({ permissions: compactOverrides(next) })
      .eq("id", row.id)
    setSaving(null)

    if (error) {
      toast.error("İzin güncellenemedi: " + error.message.slice(0, 100))
      return
    }
    toast.success(`${MODULE_LABELS[key]} ${desired ? "açıldı" : "kapatıldı"}`)
    await onChanged()
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        Modül İzinleri
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {MODULE_ORDER.map((key) => {
          const granted = effective(key)
          const isOverridden = key in row.permissions
          return (
            <button
              key={key}
              type="button"
              onClick={() => void toggle(key)}
              disabled={saving !== null}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                granted
                  ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500",
                saving === key && "opacity-50",
              )}
            >
              <span className="flex items-center gap-1.5">
                {granted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {MODULE_LABELS[key]}
              </span>
              {isOverridden && (
                <span className="text-[9px] font-bold opacity-70 uppercase">Özel</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── PIN reset ───────────────────────────────────────────────────────────────

function PinResetRow({
  row, onChanged,
}: { row: AccountRow; onChanged: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!/^[0-9]{4}$/.test(pin)) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("admin_set_pin", { p_user_id: row.id, p_new_pin: pin })
    setBusy(false)
    if (error) {
      toast.error("PIN ayarlanamadı: " + error.message.slice(0, 120))
      return
    }
    toast.success("PIN güncellendi")
    setPin(""); setOpen(false)
    await onChanged()
  }

  return (
    <div className="flex items-center gap-3">
      <KeyRound className="w-4 h-4 text-slate-400" />
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Kilit PIN'i
      </span>
      <div className="flex-1 flex items-center justify-end gap-2">
        {open ? (
          <>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="••••"
              autoFocus
              className="w-20 text-center font-mono tracking-widest px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy || pin.length !== 4}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
            >
              {busy ? "..." : "Kaydet"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setPin("") }}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              İptal
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-semibold text-violet-600 hover:text-violet-500 inline-flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            PIN Sıfırla
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Archive / restore ───────────────────────────────────────────────────────
//
// "Ayrıldı olarak arşivle" is the safe way to offboard someone. It never
// deletes anything: the profile row stays, so every historical session, sale,
// closing, discount and audit entry keeps resolving their name. What it takes
// away is the ability to USE the account — password login, PIN quick-switch,
// and any new transaction.
//
// The work is done by the admin_archive_staff / admin_restore_staff RPCs
// (migration 041), which also ban the auth.users row and drop the plaintext
// credential mirror — neither of which the browser can reach on its own.
// If those RPCs aren't deployed yet we fall back to flipping the profile
// flags, which is what this screen did before and still blocks the app.

function ArchiveRow({
  row, onChanged, disabled,
}: { row: AccountRow; onChanged: () => void | Promise<void>; disabled: boolean }) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const archived = isArchivedRow(row)

  async function run() {
    setBusy(true)
    const supabase = createClient()
    const name = row.fullName || row.username || "Hesap"

    const { error } = archived
      ? await supabase.rpc("admin_restore_staff", { p_user_id: row.id })
      : await supabase.rpc("admin_archive_staff", {
          p_user_id: row.id,
          p_reason: "Ayrıldı — /personeller üzerinden arşivlendi",
        })

    // RPC missing (migration 041 not applied yet) → flag-only fallback.
    const rpcMissing =
      !!error &&
      ((error as { code?: string }).code === "PGRST202" ||
        error.message.includes("admin_archive_staff") ||
        error.message.includes("admin_restore_staff"))

    if (rpcMissing) {
      const { error: fallbackErr } = await supabase
        .from("profiles")
        .update({ disabled: !archived, is_active: archived })
        .eq("id", row.id)
      setBusy(false); setConfirming(false)
      if (fallbackErr) {
        toast.error("Durum güncellenemedi: " + fallbackErr.message.slice(0, 100))
        return
      }
      toast.warning(
        archived ? `${name} yeniden aktifleştirildi` : `${name} devre dışı bırakıldı`,
        { description: "041 migration'ı uygulanmadı — auth tarafındaki kilit eksik." },
      )
      await onChanged()
      return
    }

    setBusy(false); setConfirming(false)
    if (error) {
      toast.error("İşlem başarısız: " + error.message.slice(0, 120))
      return
    }

    if (archived) {
      toast.success(`${name} yeniden aktif`, {
        description: "PIN ile hızlı geçiş için şifresinin yeniden tanımlanması gerekir.",
      })
    } else {
      toast.success(`${name} ayrıldı olarak arşivlendi`, {
        description: "Geçmiş kayıtları ve raporlardaki adı olduğu gibi korundu.",
      })
    }
    await onChanged()
  }

  return (
    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
      <div className="flex items-center gap-3">
        {archived ? <UserX className="w-4 h-4 text-slate-400" /> : <UserCheck className="w-4 h-4 text-emerald-500" />}
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Çalışma Durumu
        </span>
        <span className={cn("text-xs font-bold", archived ? "text-slate-500" : "text-emerald-500")}>
          {archived ? (row.leftAt ? `Ayrıldı · ${fmtDay(row.leftAt)}` : "Pasif") : "Aktif"}
        </span>

        {!confirming && (
          <button
            type="button"
            onClick={() => (archived ? void run() : setConfirming(true))}
            disabled={busy || disabled}
            className={cn(
              "ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors",
              archived
                ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 dark:text-emerald-300"
                : "bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 dark:text-rose-300",
              (busy || disabled) && "opacity-50 cursor-not-allowed",
            )}
          >
            {busy ? "..." : archived ? "Yeniden aktifleştir" : "Ayrıldı olarak arşivle"}
          </button>
        )}

        {disabled && (
          <span className="text-[10px] text-slate-400">Kendi hesabını kapatamazsın</span>
        )}
      </div>

      {confirming && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/[0.06] p-3 space-y-2">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>{row.fullName || row.username}</strong> arşivlensin mi? Giriş yapamaz,
            PIN kullanamaz ve yeni işlem oluşturamaz. Geçmiş kayıtları,
            gün sonu kapanışları ve raporlardaki adı <strong>silinmez</strong>.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void run()}
              disabled={busy}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
            >
              {busy ? "..." : "Evet, arşivle"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
