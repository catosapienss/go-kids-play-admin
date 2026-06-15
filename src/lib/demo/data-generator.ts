import { createClient } from "@/lib/supabase/client"
import { createLogger } from "@/lib/reliability/logger"

const log = createLogger("demo-gen")

// ─── Realistic Turkish-locale demo data generator ────────────────────────────
//
// All inserts go through the regular Supabase client → RLS + branch trigger
// still apply, so generated rows belong to the caller's branch automatically.
//
// Functions return counts (or thrown errors) so the UI can render a quick
// "Generated X customers / Y sessions" summary.

const FIRST_NAMES = [
  "Ahmet", "Mehmet", "Ali", "Hasan", "Mustafa", "İbrahim", "Yusuf", "Ömer",
  "Ayşe", "Fatma", "Zeynep", "Elif", "Hatice", "Emine", "Selin", "Merve",
  "Can", "Deniz", "Ece", "Defne", "Mert", "Arda", "Berk", "Eren",
]
const LAST_NAMES = [
  "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Öztürk", "Aydın",
  "Doğan", "Koç", "Arslan", "Aksoy", "Acar", "Polat", "Çetin",
]
const CHILD_NAMES = [
  "Elif", "Ada", "Defne", "Zeynep", "Mira", "Asya", "Ece", "Selin",
  "Eymen", "Yusuf", "Arda", "Çınar", "Kerem", "Poyraz", "Mete", "Berk",
]

const STAFF_NAMES = ["Selin Yıldız", "Emre Taşkın", "Burcu Demir", "Mert Aksoy"]

const ORG_TYPES = [
  { name: "Doğum Günü", childRange: [10, 20] as const, basePrice: 1500 },
  { name: "Sınıf Etkinliği", childRange: [15, 25] as const, basePrice: 2200 },
  { name: "Aile Buluşması", childRange: [6, 12] as const, basePrice: 900 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rand(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function maskedPhone(): string {
  return `05${rand(30, 59)}${String(rand(1000000, 9999999)).padStart(7, "0")}`
}

function fullName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
}

// ─── Public generators ───────────────────────────────────────────────────────

export interface GenerateResult {
  customers: number
  children:  number
  sessions:  number
  payments:  number
  organizations: number
  errors:    string[]
}

/** Tunable knobs for the populator — every field is a plain number. */
export interface GeneratorProfile {
  customers: number
  childrenPerCustomer: number
  activeSessions: number
  recentPayments: number
  organizations: number
}

/** Default profile — "realistic populated day". */
export const DEFAULT_PROFILE: GeneratorProfile = {
  customers: 12,
  childrenPerCustomer: 1,        // average; some have 2
  activeSessions: 6,             // currently inside
  recentPayments: 14,            // today, mixed methods
  organizations: 3,              // upcoming
}

export async function populateDemo(
  profile: Partial<GeneratorProfile> = {},
): Promise<GenerateResult> {
  const cfg = { ...DEFAULT_PROFILE, ...profile }
  const supabase = createClient()
  const result: GenerateResult = {
    customers: 0, children: 0, sessions: 0, payments: 0, organizations: 0, errors: [],
  }

  // 1. Customers (parents)
  const parentIds: string[] = []
  for (let i = 0; i < cfg.customers; i++) {
    try {
      const { data, error } = await supabase
        .from("parents")
        .insert({
          full_name: fullName(),
          phone:     maskedPhone(),
          wallet_balance: rand(0, 500),
          is_demo: true,
        })
        .select("id")
        .single()
      if (error) throw error
      if (data?.id) {
        parentIds.push(data.id as string)
        result.customers++
      }
    } catch (e) {
      result.errors.push(`parent insert: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 2. Children (1-2 per parent)
  const children: Array<{ id: string; parent_id: string; name: string; age: number }> = []
  for (const parentId of parentIds) {
    const count = Math.random() < 0.3 ? 2 : 1
    for (let i = 0; i < count; i++) {
      try {
        const name = pick(CHILD_NAMES)
        const age  = rand(3, 11)
        const { data, error } = await supabase
          .from("children")
          .insert({ parent_id: parentId, name, age, is_demo: true })
          .select("id, parent_id, name, age")
          .single()
        if (error) throw error
        if (data) {
          children.push(data as { id: string; parent_id: string; name: string; age: number })
          result.children++
        }
      } catch (e) {
        result.errors.push(`child insert: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  // 3. Active sessions (mix of 30/60/90 min + 1-2 unlimited)
  const shuffled = [...children].sort(() => Math.random() - 0.5)
  const wantedSessions = Math.min(cfg.activeSessions, shuffled.length)
  for (let i = 0; i < wantedSessions; i++) {
    const child = shuffled[i]
    if (!child) break
    const isUnlimited = i === 0 || (Math.random() < 0.15)
    const duration = isUnlimited ? 0 : pick([30, 60, 60, 90])
    const startedMinutesAgo = rand(2, duration > 0 ? Math.min(duration - 5, 50) : 60)
    const startTime = new Date(Date.now() - startedMinutesAgo * 60_000).toISOString()
    const endTime = duration === 0
      ? null
      : new Date(Date.now() + (duration - startedMinutesAgo) * 60_000).toISOString()
    try {
      const { error } = await supabase.from("sessions").insert({
        child_id:   child.id,
        child_name: child.name,
        child_age:  child.age,
        parent_id:  child.parent_id,
        parent_name: fullName(),
        parent_phone: maskedPhone(),
        staff_name: pick(STAFF_NAMES),
        start_time: startTime,
        end_time:   endTime,
        duration_minutes: duration,
        status:     "active",
        is_demo:    true,
      })
      if (error) throw error
      result.sessions++
    } catch (e) {
      result.errors.push(`session insert: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 4. Recent payments (mixed split methods, last 6 hours)
  for (let i = 0; i < cfg.recentPayments; i++) {
    const total = pick([100, 150, 150, 200, 250, 300])
    // Random split: 60% single-method, 40% split
    let cash = 0, card = 0, wallet = 0
    if (Math.random() < 0.6) {
      const m = pick(["cash", "card", "wallet"] as const)
      if (m === "cash") cash = total
      else if (m === "card") card = total
      else wallet = total
    } else {
      cash = rand(0, total)
      const remainder = total - cash
      card = rand(0, remainder)
      wallet = remainder - card
    }
    const createdAt = new Date(Date.now() - rand(0, 6 * 60) * 60_000).toISOString()
    try {
      const { error } = await supabase.from("payments").insert({
        cash_amount:   cash,
        card_amount:   card,
        wallet_amount: wallet,
        total_amount:  total,
        created_at:    createdAt,
        is_demo:       true,
      })
      if (error) throw error
      result.payments++
    } catch (e) {
      result.errors.push(`payment insert: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 5. Organizations (best-effort — table may not exist yet)
  for (let i = 0; i < cfg.organizations; i++) {
    const o = pick(ORG_TYPES)
    const daysFromNow = rand(1, 14)
    const eventDate = new Date(Date.now() + daysFromNow * 86_400_000)
    eventDate.setHours(rand(13, 19), 0, 0, 0)
    try {
      const { error } = await supabase.from("organizations").insert({
        name:        `${o.name} · ${pick(LAST_NAMES)}`,
        event_date:  eventDate.toISOString(),
        child_count: rand(o.childRange[0], o.childRange[1]),
        total_amount: o.basePrice + rand(-200, 400),
        is_demo:     true,
      })
      if (error) throw error
      result.organizations++
    } catch (e) {
      // Soft-fail — many fresh DBs won't have this table yet.
      result.errors.push(`organization insert: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  log.info("demo populate complete", result as unknown as Record<string, unknown>)
  return result
}

// ─── Reset (best-effort wipe of demo-generated rows) ──────────────────────────
//
// Hard reset is destructive — we mark demo-generated rows with a 0x sentinel
// in their metadata or simply rely on filtering today's rows. For the
// foundation we just rely on the operator running migration 008's
// `purge_demo_data()` helper (provided in 007_demo_seed.sql).

export async function resetDemoData(): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  try {
    // Calls the SQL-side cleanup function (added in migration 007).
    const { error } = await supabase.rpc("purge_demo_data")
    if (error) throw error
    log.info("demo data purged via RPC")
    return { ok: true, message: "Demo verisi temizlendi." }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log.warn("demo purge RPC unavailable; manual cleanup required", undefined, e)
    return {
      ok: false,
      message: `Otomatik temizlik için 007_demo_seed.sql çalıştırılmalı (${msg}).`,
    }
  }
}
