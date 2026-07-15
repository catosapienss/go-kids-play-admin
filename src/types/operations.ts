// DB row types (snake_case mirrors Supabase columns)
export interface DbParent {
  id: string
  full_name: string
  phone: string
  notes: string | null
  wallet_balance: number
  created_at: string
}

export interface DbChild {
  id: string
  parent_id: string
  full_name: string
  age: number
  allergies: string | null
  /** Optional — exists once migration 019 is applied. */
  notes?: string | null
  created_at: string
}

export interface DbSession {
  id: string
  child_id: string
  child_name: string
  child_age: number
  parent_id: string
  parent_name: string
  parent_phone: string
  staff_name: string
  start_time: string
  end_time: string | null
  duration_minutes: number
  remaining_minutes: number
  paused_remaining_seconds: number | null
  status: "active" | "completed" | "paused"
  created_by: string | null
  created_at: string
  /** Sequential per-day label number assigned by the DB trigger (migration 020). */
  daily_seq?: number | null
}

export interface DbPayment {
  id: string
  session_id: string
  cash_amount: number
  card_amount: number
  wallet_amount: number
  total_amount: number
  created_at: string
}

// Service layer DTOs
export interface ParentWithChildren extends DbParent {
  children: DbChild[]
}

export interface CreateParentInput {
  full_name: string
  phone: string
  notes?: string
}

export interface CreateChildInput {
  parent_id: string
  full_name: string
  age: number
  allergies?: string
  notes?: string
}

export interface CreateSessionInput {
  child_id: string
  child_name: string
  child_age: number
  parent_id: string
  parent_name: string
  parent_phone: string
  staff_name: string
  duration_minutes: number
  created_by?: string
  /** Note snapshot stored on the session row (sessions.child_notes). */
  child_notes?: string
  // ── Membership + campaign breakdown (migration 035, all optional) ──────────
  /** Membership this session is played under (weekday-unlimited / weekend). */
  membership_id?: string | null
  /** Paid minutes the customer purchased (before any bonus). */
  purchased_minutes?: number | null
  /** Free promotional bonus minutes (never revenue). */
  bonus_minutes?: number | null
  /** purchased + bonus (what the timer actually runs). */
  total_minutes?: number | null
  campaign_id?: string | null
  campaign_name?: string | null
}

export interface CreatePaymentInput {
  session_id: string
  cash_amount: number
  card_amount: number
  wallet_amount: number
}
