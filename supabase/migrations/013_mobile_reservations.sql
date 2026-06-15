-- ============================================================
-- GoKids Play — Mobile Purchase & Digital Check-In Flow
-- Migration 013
--
-- Pre-purchased packages bought via the parent mobile portal. The flow:
--
--   1. Parent buys a package from `/parent` → `create_mobile_reservation` RPC:
--        • Atomically deducts wallet (if used) + records the reservation
--        • Generates / reuses the parent's entry code (so QR migration is free)
--        • Status starts as `pending`
--
--   2. Parent arrives at the venue, shows the code.
--   3. Cashier types the code (existing `lookup_entry_code` RPC) — UI shows
--      a "Pending reservation: 60 dk paket" hint.
--   4. Cashier finishes check-in → `consume_mobile_reservation(reservation_id,
--      session_id)` links the rows + marks the reservation `consumed`.
--
-- All money flows are idempotent via the existing safeFinanceAction layer.
-- Wallet operations reuse the proven `load_wallet_balance` / direct UPDATE
-- patterns so the books stay clean.
-- ============================================================

create table if not exists public.pending_reservations (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid not null references public.parents(id) on delete cascade,
  child_id        uuid references public.children(id) on delete set null,

  /** 0 = unlimited package; otherwise minutes. */
  duration_minutes integer not null,
  /** Total amount the parent paid for this reservation. */
  amount          numeric(10,2) not null,
  /** Composition of the payment, summing to `amount`. */
  cash_amount     numeric(10,2) not null default 0,
  card_amount     numeric(10,2) not null default 0,
  wallet_amount   numeric(10,2) not null default 0,
  /** Provider tag for future routing — "wallet" | "simulated" | "stripe" | … */
  provider        text not null default 'simulated',

  /** The parent's entry code at time of purchase — cashier types this. */
  entry_code      text,

  /** pending → consumed (linked to session) | expired | cancelled (refunded). */
  status          text not null default 'pending'
                    check (status in ('pending', 'consumed', 'expired', 'cancelled')),

  branch_id       uuid references public.branches(id) on delete set null,

  /** Cashier-linked session once the reservation is consumed. */
  session_id      uuid references public.sessions(id) on delete set null,

  created_at      timestamptz not null default now(),
  /** Optional expiry — by default 7 days. */
  expires_at      timestamptz not null default (now() + interval '7 days'),
  consumed_at     timestamptz,
  cancelled_at    timestamptz,
  is_demo         boolean not null default false
);

create index if not exists idx_pending_res_parent  on public.pending_reservations (parent_id);
create index if not exists idx_pending_res_branch  on public.pending_reservations (branch_id);
create index if not exists idx_pending_res_status  on public.pending_reservations (status);
create index if not exists idx_pending_res_code    on public.pending_reservations (entry_code) where status = 'pending';
create index if not exists idx_pending_res_expires on public.pending_reservations (expires_at) where status = 'pending';

alter table public.pending_reservations enable row level security;

-- Read: parent sees own rows; staff sees branch rows.
drop policy if exists "read own or branch reservations" on public.pending_reservations;
create policy "read own or branch reservations" on public.pending_reservations
  for select to authenticated
  using (
    public.is_super_admin()
    or branch_id = public.current_branch()
    -- (When real parent auth ships, an OR clause for own row will be added.)
  );

drop policy if exists "branch scoped write reservations" on public.pending_reservations;
create policy "branch scoped write reservations" on public.pending_reservations
  for all to authenticated
  using (public.is_super_admin() or branch_id = public.current_branch())
  with check (public.is_super_admin() or branch_id = public.current_branch());

drop trigger if exists trg_set_branch on public.pending_reservations;
create trigger trg_set_branch
  before insert on public.pending_reservations
  for each row execute procedure public.set_branch_id_from_profile();

-- ─── RPC: create_mobile_reservation ───────────────────────────────────────────
--
-- Atomic. If `p_wallet_amount` > 0 we debit the parent's wallet and write a
-- `wallet_transactions` row in the same transaction. Returns the new row.

create or replace function public.create_mobile_reservation(
  p_parent_id        uuid,
  p_child_id         uuid,
  p_duration_minutes integer,
  p_amount           numeric,
  p_cash_amount      numeric,
  p_card_amount      numeric,
  p_wallet_amount    numeric,
  p_provider         text default 'simulated'
) returns public.pending_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.pending_reservations%rowtype;
  v_balance numeric(10,2);
  v_code    text;
begin
  -- Cents-tolerant total check.
  if abs(p_amount - (coalesce(p_cash_amount,0) + coalesce(p_card_amount,0) + coalesce(p_wallet_amount,0))) > 0.01 then
    raise exception 'amounts_do_not_sum';
  end if;

  if p_wallet_amount > 0 then
    select wallet_balance into v_balance
      from public.parents where id = p_parent_id for update;
    if v_balance is null or v_balance < p_wallet_amount then
      raise exception 'insufficient_wallet';
    end if;

    update public.parents
      set wallet_balance = wallet_balance - p_wallet_amount
      where id = p_parent_id;

    insert into public.wallet_transactions (parent_id, type, amount, description, method)
      values (p_parent_id, 'use', p_wallet_amount,
              'Mobil paket alımı (cüzdan)',
              null);
  end if;

  -- Get-or-create the entry code for this parent (re-uses existing RPC).
  v_code := public.get_or_create_entry_code(p_parent_id);

  insert into public.pending_reservations (
    parent_id, child_id, duration_minutes, amount,
    cash_amount, card_amount, wallet_amount, provider,
    entry_code
  ) values (
    p_parent_id, p_child_id, p_duration_minutes, p_amount,
    p_cash_amount, p_card_amount, p_wallet_amount, p_provider,
    v_code
  ) returning * into v_row;

  return v_row;
end;
$$;

-- ─── RPC: consume_mobile_reservation ──────────────────────────────────────────
--
-- Called by the cashier check-in flow once a session has been opened for the
-- parent. Links the reservation to the session and marks it consumed.

create or replace function public.consume_mobile_reservation(
  p_reservation_id uuid,
  p_session_id     uuid
) returns public.pending_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pending_reservations%rowtype;
begin
  update public.pending_reservations
    set status = 'consumed',
        session_id = p_session_id,
        consumed_at = now()
    where id = p_reservation_id
      and status = 'pending'
    returning * into v_row;

  if v_row.id is null then
    raise exception 'reservation_not_pending';
  end if;
  return v_row;
end;
$$;

-- ─── RPC: cancel_mobile_reservation ───────────────────────────────────────────
--
-- Parent-initiated cancel within the expiry window. Refunds wallet usage
-- back to the parent's wallet via a `refund` transaction. Cash/card portions
-- need an operator's intervention — those are flagged but NOT auto-refunded.

create or replace function public.cancel_mobile_reservation(
  p_reservation_id uuid,
  p_reason         text default 'parent_cancelled'
) returns public.pending_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pending_reservations%rowtype;
begin
  select * into v_row from public.pending_reservations
    where id = p_reservation_id for update;
  if v_row.id is null then raise exception 'reservation_not_found'; end if;
  if v_row.status <> 'pending' then raise exception 'reservation_not_pending'; end if;

  -- Auto-refund the wallet portion.
  if v_row.wallet_amount > 0 then
    update public.parents
      set wallet_balance = wallet_balance + v_row.wallet_amount
      where id = v_row.parent_id;

    insert into public.wallet_transactions (parent_id, type, amount, description, method)
      values (v_row.parent_id, 'refund', v_row.wallet_amount,
              'Mobil rezervasyon iadesi (' || p_reason || ')',
              null);
  end if;

  update public.pending_reservations
    set status = 'cancelled',
        cancelled_at = now()
    where id = p_reservation_id
    returning * into v_row;

  return v_row;
end;
$$;

-- ─── Maintenance: auto-expire stale reservations (cron-friendly) ─────────────

create or replace function public.expire_stale_reservations()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.pending_reservations
      set status = 'expired'
      where status = 'pending'
        and expires_at < now()
      returning 1
  )
  select count(*)::integer from expired;
$$;

-- ============================================================
-- End of migration 013
-- ============================================================
