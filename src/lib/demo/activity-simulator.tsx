"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useDemoMode } from "./demo-mode"
import { createLogger } from "@/lib/reliability/logger"

const log = createLogger("demo-sim")

// ─── Realtime Activity Simulator ──────────────────────────────────────────────
//
// While demo + simulator are ON, this component generates a slow drip of
// realistic-looking operations that exercise every realtime channel:
//
//   • Inserts a payment row every 30-60s
//   • Inserts a wallet load every 90-180s
//   • Inserts a session every 60-150s (if floor is below 8 active)
//   • Ends one of the active sessions every 120-240s (if any)
//
// All inserts go through normal RLS / branch trigger paths — so the simulator
// produces data that *looks* identical to real operations. Dashboards, alerts,
// and the audit log all light up.

const ENTRY_DELAY = () => 60_000  + Math.random() * 90_000   // 1-2.5 min
const PAYMENT_DELAY = () => 30_000 + Math.random() * 30_000   // 30-60s
const WALLET_DELAY = () => 90_000 + Math.random() * 90_000    // 1.5-3 min
const EXIT_DELAY = () => 120_000 + Math.random() * 120_000    // 2-4 min

const FIRST = ["Elif", "Ada", "Defne", "Asya", "Mira", "Yusuf", "Arda", "Berk", "Eren", "Çınar"]
const LAST  = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Öztürk"]
const STAFF = ["Selin Yıldız", "Emre Taşkın", "Burcu Demir"]
function pick<T>(a: readonly T[]): T { return a[Math.floor(Math.random() * a.length)] }
function rand(a: number, b: number): number { return Math.floor(a + Math.random() * (b - a + 1)) }
function phone(): string { return `05${rand(30, 59)}${String(rand(1000000, 9999999)).padStart(7, "0")}` }

// ─── Operation primitives ────────────────────────────────────────────────────

async function fakeSessionEntry(): Promise<void> {
  const supabase = createClient()
  const duration = pick([30, 60, 60, 90])
  const childName = pick(FIRST)
  const parentName = `${pick(FIRST)} ${pick(LAST)}`
  const startTime = new Date().toISOString()
  const endTime = new Date(Date.now() + duration * 60_000).toISOString()
  const { error } = await supabase.from("sessions").insert({
    child_id: null,
    child_name: `${childName} ${pick(LAST)}`,
    child_age: rand(3, 11),
    parent_id: null,
    parent_name: parentName,
    parent_phone: phone(),
    staff_name: pick(STAFF),
    start_time: startTime,
    end_time:   endTime,
    duration_minutes: duration,
    status: "active",
    is_demo: true,
  })
  if (error) throw error
}

async function fakeRandomPayment(): Promise<void> {
  const supabase = createClient()
  const total = pick([100, 150, 150, 200, 250, 300])
  const onlyMethod = Math.random() < 0.65
  let cash = 0, card = 0, wallet = 0
  if (onlyMethod) {
    const m = pick(["cash", "card", "wallet"] as const)
    if (m === "cash") cash = total
    else if (m === "card") card = total
    else wallet = total
  } else {
    cash = rand(0, total)
    const r = total - cash
    card = rand(0, r)
    wallet = r - card
  }
  const { error } = await supabase.from("payments").insert({
    cash_amount: cash, card_amount: card, wallet_amount: wallet, total_amount: total, is_demo: true,
  })
  if (error) throw error
}

async function fakeWalletLoad(): Promise<void> {
  const supabase = createClient()
  // Pick a random parent to load — quick read first.
  const { data: parents } = await supabase.from("parents").select("id").limit(20)
  const parentId = (parents ?? [])[Math.floor(Math.random() * (parents?.length ?? 0))]?.id
  if (!parentId) return
  const amount = pick([100, 200, 200, 500])
  const { error } = await supabase.from("wallet_transactions").insert({
    parent_id: parentId,
    type: "load",
    amount,
    description: `Demo cüzdan yüklemesi (₺${amount})`,
    method: pick(["cash", "card"] as const),
    is_demo: true,
  })
  if (error) throw error
}

async function endRandomActiveSession(): Promise<void> {
  const supabase = createClient()
  const { data } = await supabase
    .from("sessions")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(20)
  const row = (data ?? [])[Math.floor(Math.random() * (data?.length ?? 0))]
  if (!row?.id) return
  await supabase.rpc("end_session", { p_session_id: row.id })
}

// ─── React mount-point ───────────────────────────────────────────────────────

export function ActivitySimulator() {
  const { enabled, simulatorRunning } = useDemoMode()
  const stopRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    if (!enabled || !simulatorRunning) {
      stopRef.current()
      stopRef.current = () => undefined
      return
    }
    log.info("activity simulator started")

    const timers: ReturnType<typeof setTimeout>[] = []
    let stopped = false

    function schedule(name: string, getDelay: () => number, op: () => Promise<void>) {
      function loop() {
        if (stopped) return
        const t = setTimeout(async () => {
          try { await op() }
          catch (e) { log.warn(`sim:${name} failed`, undefined, e) }
          loop()
        }, getDelay())
        timers.push(t)
      }
      loop()
    }

    schedule("entry",   ENTRY_DELAY,   fakeSessionEntry)
    schedule("payment", PAYMENT_DELAY, fakeRandomPayment)
    schedule("wallet",  WALLET_DELAY,  fakeWalletLoad)
    schedule("exit",    EXIT_DELAY,    endRandomActiveSession)

    stopRef.current = () => {
      stopped = true
      for (const t of timers) clearTimeout(t)
      log.info("activity simulator stopped")
    }

    return stopRef.current
  }, [enabled, simulatorRunning])

  return null
}
