// ─── Channel Adapter Foundation ───────────────────────────────────────────────
//
// This module defines the *contract* for outbound notification channels
// (in-app, push, SMS, email, WhatsApp). Today only the in-app channel is
// wired through to the store; the rest are stubs that log + accept the call
// shape so the UI can already invoke them.
//
// When push/SMS/email is later wired to a real provider (FCM, Twilio,
// Mailgun, WhatsApp Business API), only the corresponding adapter file
// changes — call sites stay identical.

import type { AppNotification, NewNotification } from "@/types/notifications"

// ─── Channel types ────────────────────────────────────────────────────────────

export type ChannelId = "in-app" | "push" | "sms" | "email" | "whatsapp"

export interface ChannelTarget {
  /** profile/parent/staff id, used by future adapters to resolve contact info */
  recipientId?: string
  phone?: string
  email?: string
  /** Locale hint for templated channels (default tr-TR). */
  locale?: string
}

export interface DispatchResult {
  channel: ChannelId
  ok: boolean
  /** Provider-specific id when available (msg_xxx, sms_xxx). */
  externalId?: string
  /** Reason if dispatch was skipped or failed. */
  reason?: string
}

export interface ChannelAdapter {
  id: ChannelId
  isEnabled(): boolean
  /** Send / queue the notification through this channel. */
  send(n: AppNotification | NewNotification, target?: ChannelTarget): Promise<DispatchResult>
}

// ─── Stub adapters (foundation only) ──────────────────────────────────────────

function stubAdapter(id: ChannelId, enabled = false): ChannelAdapter {
  return {
    id,
    isEnabled: () => enabled,
    async send(n, target) {
      if (!enabled) {
        return { channel: id, ok: false, reason: "channel-disabled" }
      }
      // In dev, log the would-be payload so contract is observable.
      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.info(`[notify:${id}]`, { n, target })
      }
      return { channel: id, ok: true, externalId: `stub_${Date.now()}` }
    },
  }
}

export const pushAdapter     = stubAdapter("push")
export const smsAdapter      = stubAdapter("sms")
export const emailAdapter    = stubAdapter("email")
export const whatsappAdapter = stubAdapter("whatsapp")

// ─── Multi-channel dispatch ───────────────────────────────────────────────────
//
// Higher-level helper used by the realtime engine when a single event should
// land in several places (e.g. session-expired → in-app + future push).

export interface DispatchSpec {
  channels: ChannelId[]
  target?: ChannelTarget
}

const ADAPTERS: Record<Exclude<ChannelId, "in-app">, ChannelAdapter> = {
  push:     pushAdapter,
  sms:      smsAdapter,
  email:    emailAdapter,
  whatsapp: whatsappAdapter,
}

/**
 * Dispatch a notification to every enabled channel in `spec`. The in-app
 * channel is handled separately by the caller via the notification store.
 */
export async function dispatchExternal(
  n: AppNotification | NewNotification,
  spec: DispatchSpec,
): Promise<DispatchResult[]> {
  const tasks = spec.channels
    .filter((c) => c !== "in-app")
    .map((c) => ADAPTERS[c as Exclude<ChannelId, "in-app">]?.send(n, spec.target))
    .filter(Boolean) as Promise<DispatchResult>[]
  return Promise.all(tasks)
}

// ─── Parent-app channel preferences (foundation) ──────────────────────────────
//
// Persisted preference shape — what a parent wants to receive and via which
// channel. The Parent Mobile App will read/write this through Supabase later.

export interface ParentNotificationPreferences {
  parentId: string
  session_started:     { inApp: boolean; push: boolean; sms: boolean }
  session_expiring:    { inApp: boolean; push: boolean; sms: boolean }
  session_ended:       { inApp: boolean; push: boolean; sms: boolean }
  wallet_loaded:       { inApp: boolean; push: boolean; email: boolean }
  organization_remind: { inApp: boolean; push: boolean; email: boolean }
}

export const DEFAULT_PARENT_PREFERENCES: Omit<ParentNotificationPreferences, "parentId"> = {
  session_started:     { inApp: true, push: true,  sms: false },
  session_expiring:    { inApp: true, push: true,  sms: false },
  session_ended:       { inApp: true, push: true,  sms: false },
  wallet_loaded:       { inApp: true, push: true,  email: false },
  organization_remind: { inApp: true, push: true,  email: true },
}
