"use client"

import { useState, useCallback, useEffect } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { CustomerPanel } from "@/components/hizli-kayit/customer-panel"
import { FastChildrenInput } from "@/components/hizli-kayit/fast-children-input"
import { SessionDurationPicker } from "@/components/hizli-kayit/session-duration-picker"
import { MembershipStartBanner } from "@/components/hizli-kayit/membership-start-banner"
import { PersonalAccessBanner } from "@/components/hizli-kayit/personal-access-banner"
import { InlineRetailPanel } from "@/components/hizli-kayit/inline-retail-panel"
import { DiscountSection } from "@/components/hizli-kayit/discount-section"
import { DiscountActionButton } from "@/components/hizli-kayit/discount-action-button"
import { PaymentPanel } from "@/components/hizli-kayit/payment-panel"
import { RetailPaymentPanel, summariseRetailPayments } from "@/components/hizli-kayit/retail-payment-panel"
import { ActionBar } from "@/components/hizli-kayit/action-bar"
import { SuccessModal } from "@/components/hizli-kayit/success-modal"
import { EntryCodeLookup } from "@/components/hizli-kayit/entry-code-lookup"
import type { LookupResult } from "@/lib/services/entry-code.service"
import { ShiftClockCard } from "@/components/personel/shift-clock-card"
import { createChild, createSession, createPayment, deductWallet, updateChildNotes } from "@/lib/services/pos.service"
import { getApplicableCampaign } from "@/lib/services/campaign.service"
import { getMembershipStatusForChild, recordWeekendUsage, listActivePersonalEntitlements, consumeMembershipUse } from "@/lib/services/membership.service"
import type { MembershipRuleStatus, Membership } from "@/types/membership"
import { checkoutSale } from "@/lib/services/retail"
import {
  recordDiscount, computeDiscountAmount, maxDiscountForRole,
  type DiscountType, type DiscountReason,
} from "@/lib/services/discount.service"
import { useSettingsSection } from "@/lib/settings/settings-store"
import { recordAudit } from "@/lib/reliability/audit-log"
import { cartTotal, type CartLine } from "@/types/retail"
import { useAuth } from "@/contexts/auth-context"
import { useSessionStore } from "@/lib/stores/session-store"
import { toast } from "sonner"
import type { Customer, ChildEntry, DurationOption, PaymentEntry, PaymentMethod } from "@/types/hizli-kayit"

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

function makeChild(): ChildEntry {
  return { id: makeId(), name: "", age: "", duration: null, price: 0 }
}

function durationMinutes(d: ChildEntry["duration"]): number {
  if (d === "free") return 0
  return d ?? 60
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Split payment totals across children proportionally by price.
 * The last child gets the remainder to prevent cumulative rounding drift.
 * This ensures sum(perChild.cash) === totalCash exactly.
 */
function splitPaymentsPerChild(
  children: ChildEntry[],
  payments: PaymentEntry[],
): Array<{ cash: number; card: number; wallet: number }> {
  const totalPrice = children.reduce((s, c) => s + c.price, 0)
  const cashTotal   = payments.filter((p) => p.method === "cash")  .reduce((s, p) => s + p.amount, 0)
  const cardTotal   = payments.filter((p) => p.method === "card")  .reduce((s, p) => s + p.amount, 0)
  const walletTotal = payments.filter((p) => p.method === "wallet").reduce((s, p) => s + p.amount, 0)

  let cashAcc = 0, cardAcc = 0, walletAcc = 0

  return children.map((child, i) => {
    const isLast = i === children.length - 1
    const proportion = totalPrice > 0 ? child.price / totalPrice : 1 / children.length

    const cash   = isLast ? Math.max(0, cashTotal   - cashAcc)   : round2(cashTotal   * proportion)
    const card   = isLast ? Math.max(0, cardTotal   - cardAcc)   : round2(cardTotal   * proportion)
    const wallet = isLast ? Math.max(0, walletTotal - walletAcc) : round2(walletTotal * proportion)

    if (!isLast) { cashAcc += cash; cardAcc += card; walletAcc += wallet }

    return { cash, card, wallet }
  })
}

export default function HizliKayitPage() {
  const { user } = useAuth()
  const { refresh: refreshSessions } = useSessionStore()
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [children, setChildren] = useState<ChildEntry[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentEntry[]>([])
  const [retailPayments, setRetailPayments] = useState<PaymentEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  // Server-assigned daily label numbers (one per child, in kidsList order),
  // captured from each created session so the printed sticker matches the
  // atomic per-day sequence. See migration 020.
  const [labelNumbers, setLabelNumbers] = useState<string[]>([])
  // Snapshot of the registered children, enriched with any campaign bonus, so
  // the success modal prints labels that match what was actually sold. Taken
  // at submit time because `children` may be cleared afterwards.
  const [successKids, setSuccessKids] = useState<ChildEntry[]>([])
  // Section 3 — single duration applied to ALL children. Section 4 — retail.
  const [globalDuration,  setGlobalDuration]  = useState<DurationOption | null>(null)
  const [globalUnitPrice, setGlobalUnitPrice] = useState<number>(0)
  const [retailCart,      setRetailCart]      = useState<CartLine[]>([])
  const [discountType,    setDiscountType]    = useState<DiscountType>("fixed")
  const [discountValue,   setDiscountValue]   = useState<number>(0)
  const [discountReason,  setDiscountReason]  = useState<DiscountReason | null>(null)
  // Per-child active-membership entitlement (keyed by real child UUID). Fetched
  // when a saved child is present; drives the "Üyelikle Başlat" affordance.
  const [memStatus, setMemStatus] = useState<Record<string, MembershipRuleStatus>>({})
  // Per-child active personal access entitlements (punch passes), keyed by
  // child UUID. Drives the "Kişisel Hakkı Kullan" picker.
  const [personalEnts, setPersonalEnts] = useState<Record<string, Membership[]>>({})

  const discountLimits = useSettingsSection("discounts")

  // Fetch today's membership entitlement + personal entitlements for each saved
  // (UUID) child once.
  useEffect(() => {
    const isUUID = (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const missing = children
      .map((c) => c.id)
      .filter((id) => isUUID(id) && memStatus[id] === undefined)
    if (missing.length === 0) return
    let cancelled = false
    void Promise.all(
      missing.map(async (id) => [id, await getMembershipStatusForChild(id).catch(() => ({ hasMembership: false }))] as const),
    ).then((pairs) => {
      if (cancelled) return
      setMemStatus((prev) => {
        const next = { ...prev }
        for (const [id, st] of pairs) next[id] = st as MembershipRuleStatus
        return next
      })
    })
    void Promise.all(
      missing.map(async (id) => [id, await listActivePersonalEntitlements(id).catch(() => [])] as const),
    ).then((pairs) => {
      if (cancelled) return
      setPersonalEnts((prev) => {
        const next = { ...prev }
        for (const [id, list] of pairs) next[id] = list as Membership[]
        return next
      })
    })
    return () => { cancelled = true }
  }, [children, memStatus])

  // Sum each child's individual price (each can have a different duration).
  const gameTotal    = children.reduce((s, c) => s + (c.price || 0), 0)
  // Retail total honours per-line discounts / price overrides (effective price).
  const retailTotal  = cartTotal(retailCart)
  const grossTotal   = gameTotal + retailTotal
  // Discount applies to the GAME portion only — retail products are hard
  // goods, no loyalty markdown.
  const rawDiscount  = computeDiscountAmount(discountType, discountValue, gameTotal)
  const userCap      = maxDiscountForRole(user?.role, discountLimits)
  const discount     = Math.min(rawDiscount, isFinite(userCap) ? userCap : rawDiscount)
  const gameNet      = Math.max(0, gameTotal - discount)
  const total        = gameNet + retailTotal
  const paidGame     = payments.reduce((sum, p) => sum + p.amount, 0)
  const paidRetail   = retailPayments.reduce((sum, p) => sum + p.amount, 0)
  const isReadyToStart =
    selectedCustomer !== null &&
    children.length > 0 &&
    children.every((c) => c.name && c.duration != null) &&
    // Game portion must be fully paid. A ₺0 total is valid when every session
    // is played on a membership (no charge) — so only require coverage, not a
    // strictly-positive total.
    paidGame >= gameNet &&
    // Retail portion (if any) must be fully paid via its own tender split.
    (retailTotal === 0 || paidRetail >= retailTotal)

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer)
    if (customer.children.length > 0) {
      const prefilled: ChildEntry[] = customer.children.map((sc) => ({
        id: sc.id, // real UUID from DB — preserved so createChild is skipped on submit
        name: sc.name,
        age: sc.age,
        duration: null,
        price: 0,
        note: sc.notes?.trim() ? sc.notes.trim() : undefined,
      }))
      setChildren(prefilled)
      setSelectedChildId(prefilled[0]?.id ?? null)
    }
  }, [])

  const handleClearCustomer = useCallback(() => {
    setSelectedCustomer(null)
    setChildren([])
    setSelectedChildId(null)
    setPayments([])
    setRetailPayments([])
    setRetailCart([])
    // CRITICAL: the discount belongs to the transaction, not the terminal.
    // Without this reset a discount picked for customer A silently carried
    // over to customer B — staff perceived it as an "automatic" discount.
    setDiscountType("fixed")
    setDiscountValue(0)
    setDiscountReason(null)
    setMemStatus({})
  }, [])

  // Entry-code lookup → resolve to Customer shape and feed the existing
  // selection flow. The CustomerPanel + ChildrenPanel update in one shot.
  const handleCodeResolved = useCallback((r: Extract<LookupResult, { ok: true }>) => {
    handleSelectCustomer({
      id: r.parent.id,
      name: r.parent.full_name,
      phone: r.parent.phone,
      walletBalance: Number(r.parent.wallet_balance ?? 0),
      children: r.children.map((c) => ({ id: c.id, name: c.name, age: c.age })),
    })
  }, [handleSelectCustomer])

  const handleAddChild = useCallback((initialName?: string): string => {
    const child = makeChild()
    if (initialName) child.name = initialName
    // Pre-apply the current shared duration / unit price so the new chip is
    // immediately priced — staff doesn't need to revisit Section 3.
    if (globalDuration !== null) {
      child.duration = globalDuration
      child.price    = globalUnitPrice
    }
    setChildren((prev) => [...prev, child])
    setSelectedChildId(child.id)
    return child.id
  }, [globalDuration, globalUnitPrice])

  const handlePickGlobalDuration = useCallback((duration: DurationOption, unitPrice: number) => {
    // Remember for newly-added children.
    setGlobalDuration(duration)
    setGlobalUnitPrice(unitPrice)
    setChildren((prev) => {
      // Case 1 — a specific chip is selected → change ONLY that child.
      if (selectedChildId) {
        return prev.map((c) => c.id === selectedChildId ? { ...c, duration, price: unitPrice } : c)
      }
      // Case 2 — no chip selected → seed only children who have no duration
      // yet. Never overwrite an existing per-child choice.
      return prev.map((c) => c.duration == null ? { ...c, duration, price: unitPrice } : c)
    })
  }, [selectedChildId])

  const handleSelectChild = useCallback((id: string) => {
    setSelectedChildId(id)
  }, [])

  const handleUpdateChild = useCallback((id: string, updates: Partial<ChildEntry>) => {
    setChildren((prev) => prev.map((c) => {
      if (c.id !== id) return c
      // If staff picks a paid duration/price for a child that was on membership,
      // drop the membership flag so it's charged normally (no silent ₺0).
      const clearsMembership = c.membershipId && (updates.price ?? 0) > 0
      const cleaned = clearsMembership
        ? { membershipId: undefined, membershipMode: undefined, membershipMinutes: undefined }
        : {}
      return { ...c, ...updates, ...cleaned }
    }))
  }, [])

  /** Toggle "start on membership" for a child. On → ₺0 tracked session
   *  (weekday: unlimited; weekend: remaining daily minutes). Off → revert to
   *  a normal chargeable slot (staff re-picks a duration). */
  const handleToggleMembership = useCallback((id: string, on: boolean) => {
    setChildren((prev) => prev.map((c) => {
      if (c.id !== id) return c
      if (!on) {
        return { ...c, membershipId: undefined, membershipMode: undefined, membershipMinutes: undefined, duration: null, price: 0 }
      }
      const st = memStatus[id]
      if (!st || !st.hasMembership) return c
      const weekday = st.isWeekdayUnlimited === true
      const remaining = st.weekendRemainingMinutes ?? 0
      if (!weekday && remaining <= 0) return c
      return {
        ...c,
        membershipId: st.membershipId,
        membershipMode: weekday ? "weekday" : "weekend",
        membershipMinutes: weekday ? undefined : remaining,
        // "free" keeps the existing validation (duration != null) happy; the
        // real length is taken from membershipMode/membershipMinutes at submit.
        duration: "free",
        price: 0,
      }
    }))
  }, [memStatus])

  /** Pick (or clear) a personal access entitlement for a child. Selecting one
   *  makes this a ₺0 visit that consumes exactly that entitlement at submit;
   *  clears any monthly-membership selection so the two never collide. */
  const handlePickPersonalEntitlement = useCallback((id: string, m: Membership | null) => {
    setChildren((prev) => prev.map((c) => {
      if (c.id !== id) return c
      if (!m) {
        return { ...c, personalEntitlementId: undefined, personalEntitlementLabel: undefined, duration: null, price: 0 }
      }
      return {
        ...c,
        personalEntitlementId: m.id,
        personalEntitlementLabel: m.label ?? "Kişisel Erişim",
        // Clear monthly membership if it was set — one free source at a time.
        membershipId: undefined, membershipMode: undefined, membershipMinutes: undefined,
        // "free" satisfies validation; the visit is ₺0 and unlimited for the day.
        duration: "free",
        price: 0,
      }
    }))
  }, [])

  const handleRemoveChild = useCallback(
    (id: string) => {
      setChildren((prev) => {
        const next = prev.filter((c) => c.id !== id)
        if (selectedChildId === id) {
          setSelectedChildId(next[0]?.id ?? null)
        }
        return next
      })
      setPayments([])
    },
    [selectedChildId]
  )

  const handleAddPayment = useCallback((method: PaymentMethod, amount: number) => {
    setPayments((prev) => [...prev, { id: makeId(), method, amount }])
  }, [])

  const handleRemovePayment = useCallback((id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const handleUpdatePayment = useCallback((id: string, amount: number) => {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, amount } : p)))
  }, [])

  const handleStart = useCallback(async () => {
    // Guard: prevent double-submit while processing
    if (!isReadyToStart || !selectedCustomer || isProcessing) return
    setIsProcessing(true)

    try {
      const isUUID = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

      // Capture the first created session so the discount row can reference it.
      let firstSessionId: string | null = null

      // Collect the server-assigned daily label number for each child (in
      // order) so the success modal prints the atomic per-day sequence.
      const assignedNumbers: string[] = []

      // Split payments proportionally across children so each session's payment
      // record reflects only that child's share. Without this, a 2-child group
      // would double-count revenue in day-end reconciliation.
      const perChildPayments = splitPaymentsPerChild(children, payments)

      // Total wallet amount — deducted once from parent balance after sessions created.
      const totalWallet = payments
        .filter((p) => p.method === "wallet")
        .reduce((s, p) => s + p.amount, 0)

      // Summer campaign (migration 035): a 60-min NEW registration on Mon/Wed
      // gets +30 free min (total 90) — charge stays the 60-min price, and the
      // bonus is never counted as revenue. Config-driven; excluded packages
      // (30-min, unlimited) return { applies:false }. Fetched once for the batch.
      const camp60 = await getApplicableCampaign(60).catch(() => ({ applies: false as const }))
      let campaignApplied = false
      // Per-child campaign bonus, captured so the success modal's labels can
      // print the gifted minutes (end-time + promo line). Index-aligned with
      // `children`; 0 where no bonus applied.
      const campaignBonusByChild: number[] = []

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const split = perChildPayments[i]

        const childNote = child.note?.trim() || undefined

        // Persist new children; existing (UUID) children already have DB records.
        let childId = child.id
        if (!isUUID(child.id)) {
          try {
            childId = await createChild({
              parent_id: selectedCustomer.id,
              full_name: child.name,
              age: typeof child.age === "number" ? child.age : parseInt(child.age as string) || 0,
              allergies: (selectedCustomer as { allergies?: string }).allergies || undefined,
              notes: childNote,
            })
          } catch (childErr: unknown) {
            // eslint-disable-next-line no-console
            console.error("[hizli-kayit] createChild failed", childErr, {
              parentId: selectedCustomer.id, name: child.name,
            })
            const em = childErr instanceof Error ? childErr.message : String(childErr)
            throw new Error(`Çocuk kaydı başarısız (${child.name}): ${em}`)
          }
        } else {
          // Existing child — sync the note to the master record when the
          // operator changed it. Fire-and-forget; a note failure must never
          // block the registration.
          const savedNote = selectedCustomer.children.find((sc) => sc.id === child.id)?.notes?.trim() ?? ""
          if ((childNote ?? "") !== savedNote) {
            updateChildNotes(child.id, childNote ?? null).catch((e) => {
              // eslint-disable-next-line no-console
              console.warn("[hizli-kayit] child note sync failed", e)
            })
          }
        }

        // Personal access entitlement (₺0): a full-day unlimited entry that
        // consumes one remaining day of a customer-specific punch pass.
        const entitlementId = child.personalEntitlementId
        const isEntitlement = !!entitlementId
        // Membership session (₺0): weekday → unlimited; weekend → the child's
        // remaining daily allowance. No campaign bonus applies to free play.
        const isMembership = !isEntitlement && !!child.membershipId
        const isFree = isMembership || isEntitlement
        const mins = isEntitlement
          ? 0 // unlimited for the entry day
          : isMembership
            ? (child.membershipMode === "weekday" ? 0 : (child.membershipMinutes ?? 0))
            : durationMinutes(child.duration)
        // Apply the Mon/Wed 60→90 bonus to a paid 60-min purchase only.
        const bonus = !isFree && mins === 60 && camp60.applies ? (camp60.bonusMinutes ?? 0) : 0
        const totalMins = mins + bonus
        campaignBonusByChild[i] = bonus
        if (bonus > 0) campaignApplied = true
        let session
        try {
          session = await createSession({
            child_id: childId,
            child_name: child.name,
            child_age: typeof child.age === "number" ? child.age : parseInt(child.age as string) || 0,
            parent_id: selectedCustomer.id,
            parent_name: selectedCustomer.name,
            parent_phone: selectedCustomer.phone,
            staff_name: user?.fullName ?? "Personel",
            duration_minutes: totalMins,
            created_by: user?.id,
            child_notes: childNote,
            // free play (₺0, tracked) — monthly membership OR personal entitlement
            membership_id: isEntitlement ? entitlementId : (isMembership ? child.membershipId : undefined),
            // campaign breakdown (bonus never revenue)
            purchased_minutes: bonus > 0 ? mins : null,
            bonus_minutes: bonus > 0 ? bonus : null,
            total_minutes: bonus > 0 ? totalMins : null,
            campaign_id: bonus > 0 ? (camp60.applies ? camp60.campaignId : null) : null,
            campaign_name: bonus > 0 ? (camp60.applies ? camp60.campaignName : null) : null,
          })
        } catch (sessErr: unknown) {
          // eslint-disable-next-line no-console
          console.error("[hizli-kayit] createSession failed", sessErr, { childId, mins })
          const em = sessErr instanceof Error ? sessErr.message : String(sessErr)
          throw new Error(`Oturum oluşturulamadı (${child.name}): ${em}`)
        }

        // Server-assigned atomic daily number (migration 020). Fall back to the
        // child's index only if the column isn't present yet (pre-migration).
        assignedNumbers.push(
          session.daily_seq != null ? String(session.daily_seq) : "",
        )

        try {
          await createPayment({
            session_id: session.id,
            cash_amount:   split.cash,
            card_amount:   split.card,
            wallet_amount: split.wallet,
          })
        } catch (payErr: unknown) {
          // eslint-disable-next-line no-console
          console.error("[hizli-kayit] createPayment failed", payErr, { sessionId: session.id, split })
          const em = payErr instanceof Error ? payErr.message : String(payErr)
          throw new Error(`Ödeme kaydedilemedi (${child.name}): ${em}`)
        }

        // Weekend membership play consumes the child's daily 180-min ledger.
        // The UI caps `mins` to the remaining allowance, so this won't exceed;
        // a failure here must not roll back an already-created ₺0 session.
        if (isMembership && child.membershipMode === "weekend" && mins > 0) {
          try {
            await recordWeekendUsage(child.membershipId as string, childId, mins)
          } catch (usageErr: unknown) {
            // eslint-disable-next-line no-console
            console.warn("[hizli-kayit] weekend usage record failed", usageErr)
          }
        }

        // Consume exactly one day of the chosen personal entitlement. The
        // session is already created (the visit happened), so a consume failure
        // is logged, not rolled back — the picker only offers entitlements with
        // remaining > 0, and consume_membership_use is row-locked.
        if (isEntitlement && entitlementId) {
          try {
            await consumeMembershipUse(entitlementId)
          } catch (consErr: unknown) {
            // eslint-disable-next-line no-console
            console.warn("[hizli-kayit] personal entitlement consume failed", consErr)
            toast.warning("Giriş oluşturuldu ancak kişisel hak kullanımı düşülemedi")
          }
        }

        if (!firstSessionId) firstSessionId = session.id
      }

      // Audit the discount once per transaction (anchored to first session).
      // Fire-and-forget — failure does not roll back sessions/payments.
      if (discount > 0) {
        void recordDiscount({
          sessionId:     firstSessionId,
          parentId:      selectedCustomer.id,
          type:          discountType,
          value:         discountValue,
          amount:        discount,
          baseAmount:    grossTotal,
          reason:        discountReason,
          appliedBy:     user?.id ?? null,
          appliedByName: user?.fullName ?? null,
        })
      }

      // Deduct wallet balance once, after all sessions are created.
      if (totalWallet > 0) {
        await deductWallet(selectedCustomer.id, totalWallet)
      }

      // Retail cart — paid from its OWN payment stream (retailPayments),
      // so day-end reports show the exact tender the operator picked for
      // retail, not a proportional guess.
      if (retailCart.length > 0 && retailTotal > 0) {
        const s = summariseRetailPayments(retailPayments)
        try {
          await checkoutSale({
            cashierId:     user?.id ?? "",
            cart:          retailCart,
            paymentMethod: s.method,
            cashAmount:    round2(s.cash),
            cardAmount:    round2(s.card),
            notes:         `Hızlı Kayıt · ${selectedCustomer.name}`,
            parentId:      selectedCustomer.id,
          })
        } catch (e) {
          // Retail failure must not roll back already-created sessions.
          // eslint-disable-next-line no-console
          console.warn("[hizli-kayit] retail checkout failed", e)
          toast.warning("Oyun başladı ancak perakende kaydı oluşturulamadı")
        }
      }

      // Defensive: refetch the active-session store so the new row(s) show up
      // even if the realtime publication for `sessions` isn't configured. This
      // makes "registration → appears in Active Sessions" deterministic.
      void refreshSessions()

      // Enrich each child with its campaign bonus so the labels reflect the
      // gift (end-time + promo line). Only children that actually received a
      // bonus are touched; everyone else is passed through unchanged.
      setSuccessKids(children.map((c, i) =>
        campaignBonusByChild[i] > 0
          ? { ...c, campaignBonusMinutes: campaignBonusByChild[i] }
          : c,
      ))
      setLabelNumbers(assignedNumbers)
      setShowSuccess(true)
      if (campaignApplied) {
        toast.success("Oyun başlatıldı! 🎁", {
          description: `Kampanya: Satın Alınan 60 dk + Hediye ${camp60.applies ? camp60.bonusMinutes : 30} dk = Toplam ${60 + (camp60.applies ? (camp60.bonusMinutes ?? 30) : 30)} dk`,
        })
      } else {
        toast.success("Oyun başlatıldı!")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "İşlem başarısız"
      toast.error("Hata: " + msg)
    } finally {
      setIsProcessing(false)
    }
  }, [isReadyToStart, isProcessing, selectedCustomer, children, payments, retailPayments, retailCart, retailTotal, gameNet, grossTotal, discount, discountType, discountValue, discountReason, user, refreshSessions])

  const handleClear = useCallback(() => {
    setSelectedCustomer(null)
    setChildren([])
    setSelectedChildId(null)
    setPayments([])
    setRetailPayments([])
    setGlobalDuration(null)
    setGlobalUnitPrice(0)
    setRetailCart([])
    setDiscountType("fixed")
    setDiscountValue(0)
    setDiscountReason(null)
    setLabelNumbers([])
    setMemStatus({})
  }, [])

  /** Cancel button — audit-logged clear so managers can trace who aborted
   *  a mid-transaction registration. Captures the customer + kids at the
   *  moment of cancellation for accountability. */
  const handleCancel = useCallback(() => {
    void recordAudit({
      action:     "hizli-kayit.cancel",
      severity:   "warning",
      entityType: "session",
      entityId:   selectedCustomer?.id,
      meta: {
        parent_name:  selectedCustomer?.name  ?? null,
        parent_phone: selectedCustomer?.phone ?? null,
        child_names:  children.map((c) => c.name).filter(Boolean),
        gross_total:  grossTotal,
        cancelled_by: user?.fullName ?? user?.email ?? null,
        cancelled_at: new Date().toISOString(),
      },
    })
    handleClear()
    toast.info("İşlem iptal edildi ve kayda alındı")
  }, [selectedCustomer, children, grossTotal, user, handleClear])

  const handleSuccessClose = useCallback(() => {
    setShowSuccess(false)
    handleClear()
  }, [handleClear])

  return (
    <MainLayout title="Hızlı Kayıt" subtitle="Kasa ekranı · Maks 10 saniyede işlem">
      <div className="flex flex-col -m-6 overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
        {/* Shift clock + entry-code lookup are intentionally hidden — operations
            don't use them yet. Imports kept so re-enabling later is a single
            uncomment, no refactor. */}

        {/* 3-column main area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 min-h-0 overflow-hidden">
          {/* LEFT: Customer */}
          <div className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-4 lg:p-5 overflow-y-auto">
            <CustomerPanel
              selectedCustomer={selectedCustomer}
              onSelect={handleSelectCustomer}
              onClear={handleClearCustomer}
            />
          </div>

          {/* MIDDLE: Children + Duration */}
          <div className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-4 lg:p-5 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/30 space-y-3">
            <FastChildrenInput
              kidsList={children}
              selectedChildId={selectedChildId}
              onAdd={handleAddChild}
              onSelect={handleSelectChild}
              onUpdate={handleUpdateChild}
              onRemove={handleRemoveChild}
            />
            {selectedChildId && (() => {
              const sc = children.find((c) => c.id === selectedChildId)
              if (!sc) return null
              return (
                <>
                  <PersonalAccessBanner
                    entitlements={personalEnts[sc.id] ?? []}
                    selectedId={sc.personalEntitlementId}
                    onSelect={(m) => handlePickPersonalEntitlement(sc.id, m)}
                  />
                  <MembershipStartBanner
                    status={memStatus[sc.id]}
                    active={!!sc.membershipId}
                    onToggle={(on) => handleToggleMembership(sc.id, on)}
                  />
                </>
              )
            })()}
            <SessionDurationPicker
              duration={
                // Show the currently selected chip's duration if one is
                // selected, else fall back to the shared default.
                selectedChildId
                  ? children.find((c) => c.id === selectedChildId)?.duration ?? null
                  : globalDuration
              }
              unitPrice={
                selectedChildId
                  ? children.find((c) => c.id === selectedChildId)?.price ?? 0
                  : globalUnitPrice
              }
              childCount={children.length}
              selectedChildName={
                selectedChildId
                  ? children.find((c) => c.id === selectedChildId)?.name ?? null
                  : null
              }
              onChange={handlePickGlobalDuration}
            />
          </div>

          {/* RIGHT: fixed payment sidebar — always visible, own scroll.
              Order per operations request: Ödeme Özeti/Türü/Toplam → İndirim
              → Perakende ürünleri (çorap vb.) → Perakende ödemesi. */}
          <div className="p-4 lg:p-5 overflow-y-auto space-y-3 bg-white dark:bg-slate-900/40">
            <PaymentPanel
              total={gameNet}
              gameTotal={gameTotal}
              retailTotal={0}
              discount={discount}
              payments={payments}
              customer={selectedCustomer}
              onAddPayment={handleAddPayment}
              onRemovePayment={handleRemovePayment}
              onUpdatePayment={handleUpdatePayment}
            />
            <DiscountSection
              baseAmount={grossTotal}
              amount={discount}
              type={discountType}
              value={discountValue}
              reason={discountReason}
              onChange={({ type, value, reason }) => {
                setDiscountType(type)
                setDiscountValue(value)
                setDiscountReason(reason)
              }}
            />
            <InlineRetailPanel cart={retailCart} onChange={setRetailCart} />
            <RetailPaymentPanel
              total={retailTotal}
              payments={retailPayments}
              onAdd={(method, amount) => setRetailPayments((prev) => [...prev, { id: makeId(), method, amount }])}
              onRemove={(id) => setRetailPayments((prev) => prev.filter((p) => p.id !== id))}
              onUpdate={(id, amount) => setRetailPayments((prev) => prev.map((p) => (p.id === id ? { ...p, amount } : p)))}
            />
          </div>
        </div>

        {/* BOTTOM: Action bar */}
        <ActionBar
          canStart={isReadyToStart}
          isProcessing={isProcessing}
          onStart={handleStart}
          onExtend={() => {}}
          onCancel={handleCancel}
          onClear={handleClear}
          onQr={() => {}}
          discountSlot={
            <DiscountActionButton
              baseAmount={grossTotal}
              amount={discount}
              type={discountType}
              value={discountValue}
              reason={discountReason}
              onChange={({ type, value, reason }) => {
                setDiscountType(type)
                setDiscountValue(value)
                setDiscountReason(reason)
              }}
            />
          }
        />
      </div>

      {showSuccess && selectedCustomer && (
        <SuccessModal
          customer={selectedCustomer}
          kidsList={successKids.length > 0 ? successKids : children}
          total={total}
          labelNumbers={labelNumbers}
          brewmoodDiscountPct={children.reduce((pct, c) => {
            const st = memStatus[c.id]
            return st?.hasMembership ? Math.max(pct, st.brewmoodDiscountPct ?? 0) : pct
          }, 0) || undefined}
          onClose={handleSuccessClose}
        />
      )}
    </MainLayout>
  )
}
