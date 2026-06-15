"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useNotificationStore } from "@/lib/stores/notification-store"
import { useBranch } from "@/lib/branch/branch-context"
import { branchChannelName, branchPostgresFilter } from "@/lib/branch/realtime-channel"
import type { NewNotification } from "@/types/notifications"

// ─── Realtime Alert Engine ────────────────────────────────────────────────────
//
// Mounts once at the app root. Subscribes to relevant Supabase tables and
// converts INSERT/UPDATE events into AppNotifications via the store.
//
// Kept as a *component* (returning null) so it lifts a single subscription
// per browser tab and tears down cleanly on unmount.

interface SessionRow {
  id: string
  child_name: string
  parent_name: string | null
  staff_name: string | null
  status: "active" | "paused" | "completed"
  duration_minutes: number
}

interface PaymentRow {
  id: string
  session_id: string | null
  total_amount: number
  cash_amount: number
  card_amount: number
  wallet_amount: number
}

interface WalletTxRow {
  id: string
  parent_id: string
  type: "load" | "use" | "refund" | "bonus"
  amount: number
}

interface RefundRow {
  id: string
  session_id: string
  parent_id: string | null
  refund_amount: number
  refund_reason: string
}

export function RealtimeAlertEngine() {
  const { push } = useNotificationStore()
  const { activeBranchId } = useBranch()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(branchChannelName("alert-engine", activeBranchId))
    const branchFilter = branchPostgresFilter(activeBranchId)
    const f = branchFilter ? { filter: branchFilter } : {}

    // ── sessions: new entry / completion ──────────────────────────────────────
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "sessions", ...f },
      (payload) => {
        const r = payload.new as SessionRow
        const unlimited = r.duration_minutes === 0
        const n: NewNotification = {
          category: "session",
          severity: "info",
          source:   "realtime",
          title:    `${r.child_name} oyuna başladı`,
          body:     unlimited ? "Sınırsız paket · süre takibi yok" : `${r.duration_minutes} dk paket`,
          sessionId: r.id,
          childName: r.child_name,
          action: { label: "Aktif oyuna git", href: "/aktif-oyun" },
        }
        push(n)
      },
    )

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sessions", ...f },
      (payload) => {
        const before = payload.old as Partial<SessionRow>
        const after  = payload.new as SessionRow
        if (before.status !== "completed" && after.status === "completed") {
          push({
            category: "session",
            severity: "success",
            source:   "realtime",
            title:    `${after.child_name} çıkış yaptı`,
            body:     "Oturum başarıyla tamamlandı.",
            sessionId: after.id,
            childName: after.child_name,
          })
        }
      },
    )

    // ── payments: success ─────────────────────────────────────────────────────
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "payments", ...f },
      (payload) => {
        const r = payload.new as PaymentRow
        const total = Number(r.total_amount)
        const parts: string[] = []
        if (Number(r.cash_amount)   > 0) parts.push(`Nakit ₺${r.cash_amount}`)
        if (Number(r.card_amount)   > 0) parts.push(`Kart ₺${r.card_amount}`)
        if (Number(r.wallet_amount) > 0) parts.push(`Cüzdan ₺${r.wallet_amount}`)
        push({
          category: "payment",
          severity: "success",
          source:   "realtime",
          title:    `Ödeme alındı · ₺${total.toLocaleString("tr-TR")}`,
          body:     parts.join(" · ") || "Tek seferde tamamlandı.",
          sessionId: r.session_id ?? undefined,
          silent:   true,   // Don't toast on every payment — too noisy.
        })
      },
    )

    // ── wallet transactions ───────────────────────────────────────────────────
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "wallet_transactions", ...f },
      (payload) => {
        const r = payload.new as WalletTxRow
        if (r.type === "load") {
          push({
            category: "wallet",
            severity: "success",
            source:   "realtime",
            title:    "Cüzdan yüklendi",
            body:     `+₺${Number(r.amount).toLocaleString("tr-TR")}`,
            parentId: r.parent_id,
            silent:   true,
          })
        } else if (r.type === "refund") {
          push({
            category: "refund",
            severity: "warning",
            source:   "realtime",
            title:    "Cüzdana iade yapıldı",
            body:     `+₺${Number(r.amount).toLocaleString("tr-TR")} (iade)`,
            parentId: r.parent_id,
          })
        }
      },
    )

    // ── refund logs ───────────────────────────────────────────────────────────
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "refund_logs", ...f },
      (payload) => {
        const r = payload.new as RefundRow
        push({
          category: "refund",
          severity: "warning",
          source:   "realtime",
          title:    "İptal & iade işlendi",
          body:     `₺${Number(r.refund_amount).toLocaleString("tr-TR")} — ${r.refund_reason}`,
          sessionId: r.session_id,
          parentId:  r.parent_id ?? undefined,
          action:    { label: "Mali rapor", href: "/raporlar" },
        })
      },
    )

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [push, activeBranchId])

  return null
}
