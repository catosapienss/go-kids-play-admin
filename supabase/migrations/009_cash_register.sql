-- ============================================================
-- GoKids Play — Day-End Closing & Cash Register Management
-- Migration 009
--
-- The cash register lifecycle:
--
--   1. At the start of each business day a row is automatically opened
--      (lazy — first read of `getOpenRegister()` creates it if missing).
--   2. Throughout the day the *expected* totals are derived from `payments` /
--      `refund_logs` / `wallet_transactions` (no manual entry needed).
--   3. At day-end the manager counts the actual cash + card terminal totals
--      and submits `close_cash_register()` — the RPC:
--        a) snapshots every relevant number (so historical reports are stable)
--        b) computes per-method discrepancies
--        c) requires notes whenever a discrepancy is non-zero
--        d) marks the register `closed` (idempotent — duplicate closes raise)
--
-- The whole table is branch-scoped (multi-branch ready) and admin-gated.
-- ============================================================

-- ─── 1. Table ─────────────────────────────────────────────────────────────────

create table if not exists public.cash_register_closings (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references public.branches(id) on delete set null,
  /** Calendar day the register covers (in branch local time). */
  business_date   date not null default current_date,
  status          text not null default 'open'
                    check (status in ('open', 'closed')),

  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  closed_by       uuid references auth.users(id) on delete set null,
  closed_by_name  text,

  -- Expected (system-computed) totals at close time.
  expected_cash    numeric(10,2) not null default 0,
  expected_card    numeric(10,2) not null default 0,
  expected_wallet  numeric(10,2) not null default 0,
  expected_total   numeric(10,2) not null default 0,

  -- Counted (manager-entered) totals.
  counted_cash    numeric(10,2) not null default 0,
  counted_card    numeric(10,2) not null default 0,
  counted_wallet  numeric(10,2) not null default 0,

  -- Cached discrepancy per method (= counted - expected). Negative = eksik.
  diff_cash    numeric(10,2) generated always as (counted_cash    - expected_cash)    stored,
  diff_card    numeric(10,2) generated always as (counted_card    - expected_card)    stored,
  diff_wallet  numeric(10,2) generated always as (counted_wallet  - expected_wallet)  stored,

  -- Side metrics (snapshotted at close).
  refund_total      numeric(10,2) not null default 0,
  session_count     integer       not null default 0,
  transaction_count integer       not null default 0,

  -- Free-form notes (mandatory at close-time when any diff != 0).
  notes            text not null default '',

  -- Snapshot of richer report data (hourly breakdown, top package, staff perf).
  -- Kept as jsonb so the report stays stable even if base data is later edited.
  meta             jsonb not null default '{}'::jsonb,

  is_demo          boolean not null default false
);

-- One *open* register per branch per business_date.
create unique index if not exists uq_one_open_register_per_branch_day
  on public.cash_register_closings (branch_id, business_date)
  where status = 'open';

create index if not exists idx_cash_register_branch    on public.cash_register_closings (branch_id);
create index if not exists idx_cash_register_status    on public.cash_register_closings (status);
create index if not exists idx_cash_register_business  on public.cash_register_closings (business_date desc);
create index if not exists idx_cash_register_closed_at on public.cash_register_closings (closed_at desc);

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────

alter table public.cash_register_closings enable row level security;

drop policy if exists "branch scoped read" on public.cash_register_closings;
create policy "branch scoped read" on public.cash_register_closings
  for select to authenticated
  using (public.is_super_admin() or branch_id = public.current_branch());

-- Writes are restricted to admin/manager roles by application convention; we
-- also enforce it server-side via the RPC's role check.
drop policy if exists "branch scoped write" on public.cash_register_closings;
create policy "branch scoped write" on public.cash_register_closings
  for all to authenticated
  using (public.is_super_admin() or branch_id = public.current_branch())
  with check (public.is_super_admin() or branch_id = public.current_branch());

drop trigger if exists trg_set_branch on public.cash_register_closings;
create trigger trg_set_branch
  before insert on public.cash_register_closings
  for each row execute procedure public.set_branch_id_from_profile();

-- ─── 3. RPC: open_cash_register — lazy idempotent open ────────────────────────
--
-- Called on first read. Creates an `open` row for today's branch if none exists
-- and returns its id. Subsequent calls return the existing row.

create or replace function public.open_cash_register()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch uuid;
  v_id     uuid;
begin
  v_branch := public.current_branch();

  -- Reuse an existing open register if any.
  select id into v_id
    from public.cash_register_closings
    where status = 'open'
      and business_date = current_date
      and (branch_id is not distinct from v_branch);

  if v_id is not null then return v_id; end if;

  insert into public.cash_register_closings (branch_id, business_date, status)
    values (v_branch, current_date, 'open')
    returning id into v_id;
  return v_id;
end;
$$;

-- ─── 4. RPC: get_expected_totals — what the system thinks today brought in ───
--
-- Aggregates the live operational tables. Returns a row with the same column
-- names as `cash_register_closings` so the UI can render either source uniformly.

create or replace function public.get_expected_totals()
returns table(
  expected_cash      numeric(10,2),
  expected_card      numeric(10,2),
  expected_wallet    numeric(10,2),
  expected_total     numeric(10,2),
  refund_total       numeric(10,2),
  session_count      integer,
  transaction_count  integer
)
language sql
stable
security definer
set search_path = public
as $$
  with day_payments as (
    select * from public.payments
    where created_at >= date_trunc('day', now())
      and (public.is_super_admin() or branch_id = public.current_branch())
  ),
  day_refunds as (
    select coalesce(sum(refund_amount), 0)::numeric(10,2) as total
    from public.refund_logs
    where created_at >= date_trunc('day', now())
      and (public.is_super_admin() or branch_id = public.current_branch())
  ),
  day_sessions as (
    select count(*)::integer as n
    from public.sessions
    where created_at >= date_trunc('day', now())
      and (public.is_super_admin() or branch_id = public.current_branch())
  )
  select
    coalesce(sum(p.cash_amount),   0)::numeric(10,2) as expected_cash,
    coalesce(sum(p.card_amount),   0)::numeric(10,2) as expected_card,
    coalesce(sum(p.wallet_amount), 0)::numeric(10,2) as expected_wallet,
    coalesce(sum(p.total_amount),  0)::numeric(10,2) as expected_total,
    (select total from day_refunds)                  as refund_total,
    (select n from day_sessions)                     as session_count,
    count(p.*)::integer                              as transaction_count
  from day_payments p
$$;

-- ─── 5. RPC: close_cash_register — the day-end action ─────────────────────────
--
-- Snapshots all numbers + caller identity + notes, marks the register closed.
-- Role check is explicit (admin/manager only) — RLS keeps cashiers from even
-- seeing other branches' rows but this guards the action itself.

create or replace function public.close_cash_register(
  p_counted_cash    numeric,
  p_counted_card    numeric,
  p_counted_wallet  numeric,
  p_notes           text,
  p_meta            jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_register_id uuid;
  v_branch      uuid;
  v_role        text;
  v_full_name   text;
  v_expected    record;
  v_register    public.cash_register_closings%rowtype;
begin
  select role, full_name, branch_id
    into v_role, v_full_name, v_branch
    from public.profiles
    where id = auth.uid();

  if v_role not in ('super_admin', 'admin', 'manager') then
    raise exception 'forbidden: cash close requires admin or manager role';
  end if;

  -- Ensure there's an open register (lazy-create).
  v_register_id := public.open_cash_register();

  -- Fetch expected totals.
  select * into v_expected from public.get_expected_totals() limit 1;

  -- Discrepancy precheck — if any method is off, notes are mandatory.
  if (p_counted_cash   <> v_expected.expected_cash
   or p_counted_card   <> v_expected.expected_card
   or p_counted_wallet <> v_expected.expected_wallet)
   and coalesce(length(btrim(p_notes)), 0) = 0
  then
    raise exception 'discrepancy_requires_notes';
  end if;

  -- Commit the close. status='open' guard makes the UPDATE idempotent — the
  -- second call falls through with 0 rows touched.
  update public.cash_register_closings
    set
      status            = 'closed',
      closed_at         = now(),
      closed_by         = auth.uid(),
      closed_by_name    = coalesce(v_full_name, 'system'),
      expected_cash     = v_expected.expected_cash,
      expected_card     = v_expected.expected_card,
      expected_wallet   = v_expected.expected_wallet,
      expected_total    = v_expected.expected_total,
      counted_cash      = p_counted_cash,
      counted_card      = p_counted_card,
      counted_wallet    = p_counted_wallet,
      refund_total      = v_expected.refund_total,
      session_count     = v_expected.session_count,
      transaction_count = v_expected.transaction_count,
      notes             = coalesce(p_notes, ''),
      meta              = p_meta
    where id = v_register_id and status = 'open'
    returning * into v_register;

  if v_register.id is null then
    raise exception 'register_already_closed';
  end if;

  return to_jsonb(v_register);
end;
$$;

-- ─── 6. RPC: list_recent_closings (for the history panel) ────────────────────

create or replace function public.list_recent_closings(p_limit integer default 20)
returns setof public.cash_register_closings
language sql
stable
security definer
set search_path = public
as $$
  select * from public.cash_register_closings
    where status = 'closed'
      and (public.is_super_admin() or branch_id = public.current_branch())
    order by closed_at desc
    limit greatest(1, least(p_limit, 100));
$$;

-- ============================================================
-- End of migration 009
-- ============================================================
