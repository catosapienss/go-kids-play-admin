"use client"

import { useEffect, useMemo, useState } from "react"
import { Cake, PartyPopper, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { getEventSummary } from "@/lib/services/analytics.service"

// ─── TV Event Banner ─────────────────────────────────────────────────────────
//
// Optional overlay strip that surfaces *today's* birthday parties and any
// upcoming organisation starting within the next 90 minutes. Falls back to
// silence when no event is active so a quiet day's TV display stays clean.
//
// Polls every 5 minutes — the data source (organizations table) is low-volume.

const POLL_MS = 5 * 60_000
const SOON_THRESHOLD_MS = 90 * 60_000

interface UpcomingEvent {
  name: string
  childCount: number
  startsInMs: number
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "Başladı"
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m} dk içinde`
  const h = Math.floor(m / 60)
  return `${h}sa ${m % 60}dk içinde`
}

export function TvEventBanner() {
  const [todayCount, setTodayCount] = useState(0)
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([])
  const [tick, setTick] = useState(0)

  // Cheap 30s ticker so the countdown stays current without a full re-fetch.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  void tick

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const s = await getEventSummary()
        if (cancelled) return
        setTodayCount(s.todayBirthdays ?? 0)
        const now = Date.now()
        const soon: UpcomingEvent[] = (s.upcomingOrgs ?? [])
          .map((o) => {
            const t = new Date(o.date).getTime()
            return {
              name: o.name,
              childCount: o.childCount,
              startsInMs: t - now,
            }
          })
          .filter((o) => o.startsInMs > -60_000 && o.startsInMs <= SOON_THRESHOLD_MS)
          .sort((a, b) => a.startsInMs - b.startsInMs)
          .slice(0, 2)
        setUpcoming(soon)
      } catch {
        // Best-effort — TV display must never break on a missing org table.
      }
    }

    void load()
    const id = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const items = useMemo(() => {
    const out: { kind: "birthday" | "org"; text: string; hint: string }[] = []
    if (todayCount > 0) {
      out.push({
        kind: "birthday",
        text: `Bugün ${todayCount} doğum günü partisi`,
        hint: "Karşılama hazır olsun",
      })
    }
    for (const u of upcoming) {
      out.push({
        kind: "org",
        text: u.name,
        hint: `${u.childCount} çocuk · ${fmtCountdown(u.startsInMs)}`,
      })
    }
    return out
  }, [todayCount, upcoming])

  if (items.length === 0) return null

  return (
    <div className="px-8 lg:px-12 pb-2">
      <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-r from-pink-500/[0.12] via-fuchsia-500/[0.08] to-violet-500/[0.10] backdrop-blur-sm overflow-hidden">
        <ul className="flex divide-x divide-white/10">
          {items.map((it, i) => {
            const Icon = it.kind === "birthday" ? Cake : PartyPopper
            return (
              <li key={i} className="flex-1 flex items-center gap-4 px-6 py-3">
                <div className="w-11 h-11 rounded-2xl bg-pink-500/25 text-pink-200 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-white truncate leading-tight">{it.text}</p>
                  <p className="text-[11px] uppercase tracking-widest text-pink-200/70 font-semibold mt-0.5">
                    {it.hint}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
