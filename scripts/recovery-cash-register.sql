-- ─── Recovery — Cash Register (migration 009 minus the branches FK) ────────
--
-- Production was missing cash_register_closings table and the 4 RPCs the
-- /gun-sonu screen reads from. Original migration 009 references
-- public.branches (multi-branch) which was never created — strip the FK.
-- Everything else mirrors 009 so behaviour matches the docs.

create extension if not exists pgcrypto;

-- ── 1. The closings table ─────────────────────────────────────────────────
create table if not exists public.cash_register_closings (
  id                  uuid primary key default gen_random_uuid(),
  business_date       date not null default current_date,
  opened_at           timestamptz not null default now(),
  closed_at           timestamptz,
  closed_by           uuid references public.profiles(id),
  status              text not null default 'open'
                      check (status in ('open','closed')),

  -- Expected (computed at close from payments/refunds/wallet)
  expected_cash       numeric(12,2) not null default 0,
  expected_card       numeric(12,2) not null default 0,
  expected_wallet     numeric(12,2) not null default 0,
  expected_total      numeric(12,2) not null default 0,

  -- Counted (entered by manager at close)
  counted_cash        numeric(12,2) not null default 0,
  counted_card        numeric(12,2) not null default 0,
  counted_wallet      numeric(12,2) not null default 0,
  counted_total       numeric(12,2) not null default 0,

  -- Derived
  cash_diff           numeric(12,2) not null default 0,
  card_diff           numeric(12,2) not null default 0,
  wallet_diff         numeric(12,2) not null default 0,
  total_diff          numeric(12,2) not null default 0,

  -- Refunds snapshot
  refund_total        numeric(12,2) not null default 0,
  refund_count        int           not null default 0,

  notes               text,
  branch_id           uuid,
  created_at          timestamptz not null default now()
);

create unique index if not exists cash_register_closings_business_date_idx
  on public.cash_register_closings (business_date)
  where branch_id is null;

create index if not exists cash_register_closings_status_idx
  on public.cash_register_closings (status, business_date desc);

alter table public.cash_register_closings enable row level security;

drop policy if exists "cash_register_closings select" on public.cash_register_closings;
create policy "cash_register_closings select"
  on public.cash_register_closings for select
  to authenticated using (true);

drop policy if exists "cash_register_closings insert" on public.cash_register_closings;
create policy "cash_register_closings insert"
  on public.cash_register_closings for insert
  to authenticated with check (auth.uid() is not null);

drop policy if exists "cash_register_closings update" on public.cash_register_closings;
create policy "cash_register_closings update"
  on public.cash_register_closings for update
  to authenticated using (auth.uid() is not null);

-- ── 2. RPC: open_cash_register ────────────────────────────────────────────
-- Lazy: creates today's row if missing, returns the row (open or closed).
create or replace function public.open_cash_register()
returns public.cash_register_closings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cash_register_closings%rowtype;
begin
  select * into v_row
    from public.cash_register_closings
   where business_date = current_date
   limit 1;

  if not found then
    insert into public.cash_register_closings (business_date, opened_at, status)
    values (current_date, now(), 'open')
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.open_cash_register() to authenticated;

-- ── 3. RPC: get_today_register ────────────────────────────────────────────
create or replace function public.get_today_register()
returns public.cash_register_closings
language sql
security definer
set search_path = public
as $$
  select * from public.cash_register_closings
   where business_date = current_date
   limit 1;
$$;

grant execute on function public.get_today_register() to authenticated;

-- ── 4. RPC: get_expected_totals ───────────────────────────────────────────
-- Live aggregate from payments + refund_logs + wallet_transactions for today.
create or replace function public.get_expected_totals()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cash    numeric := 0;
  v_card    numeric := 0;
  v_wallet  numeric := 0;
  v_refund  numeric := 0;
  v_refund_count int := 0;
begin
  -- payments today
  select
    coalesce(sum(p.cash_amount), 0),
    coalesce(sum(p.card_amount), 0),
    coalesce(sum(p.wallet_amount), 0)
    into v_cash, v_card, v_wallet
    from public.payments p
   where date(p.created_at) = current_date;

  -- refunds today (best-effort: refund_logs may have evolved)
  begin
    select coalesce(sum(refund_amount), 0), count(*)
      into v_refund, v_refund_count
      from public.refund_logs
     where date(created_at) = current_date;
  exception when undefined_table or undefined_column then
    v_refund := 0; v_refund_count := 0;
  end;

  return json_build_object(
    'expectedCash',   v_cash,
    'expectedCard',   v_card,
    'expectedWallet', v_wallet,
    'expectedTotal',  v_cash + v_card + v_wallet,
    'refundTotal',    v_refund,
    'refundCount',    v_refund_count
  );
end;
$$;

grant execute on function public.get_expected_totals() to authenticated;

-- ── 5. RPC: close_cash_register ───────────────────────────────────────────
create or replace function public.close_cash_register(
  p_counted_cash   numeric,
  p_counted_card   numeric,
  p_counted_wallet numeric,
  p_notes          text default null
) returns public.cash_register_closings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    public.cash_register_closings%rowtype;
  v_caller text;
  v_exp    json;
  v_ec     numeric; v_ed_card numeric; v_ed_wal numeric;
  v_total_counted numeric;
  v_total_expected numeric;
begin
  -- Permission: admin or manager only
  select role into v_caller from public.profiles where id = auth.uid();
  if v_caller not in ('admin','super_admin','manager') then
    raise exception 'Only admin or manager can close the register';
  end if;

  -- Ensure today's row exists
  perform public.open_cash_register();
  select * into v_row from public.cash_register_closings
   where business_date = current_date for update;
  if v_row.status = 'closed' then
    raise exception 'Today''s register is already closed';
  end if;

  -- Snapshot expected
  select public.get_expected_totals() into v_exp;
  v_ec       := (v_exp->>'expectedCash')::numeric;
  v_ed_card  := (v_exp->>'expectedCard')::numeric;
  v_ed_wal   := (v_exp->>'expectedWallet')::numeric;
  v_total_counted  := coalesce(p_counted_cash,0) + coalesce(p_counted_card,0) + coalesce(p_counted_wallet,0);
  v_total_expected := v_ec + v_ed_card + v_ed_wal;

  update public.cash_register_closings
     set status         = 'closed',
         closed_at      = now(),
         closed_by      = auth.uid(),
         expected_cash  = v_ec,
         expected_card  = v_ed_card,
         expected_wallet = v_ed_wal,
         expected_total = v_total_expected,
         counted_cash   = coalesce(p_counted_cash, 0),
         counted_card   = coalesce(p_counted_card, 0),
         counted_wallet = coalesce(p_counted_wallet, 0),
         counted_total  = v_total_counted,
         cash_diff      = coalesce(p_counted_cash, 0)   - v_ec,
         card_diff      = coalesce(p_counted_card, 0)   - v_ed_card,
         wallet_diff    = coalesce(p_counted_wallet, 0) - v_ed_wal,
         total_diff     = v_total_counted - v_total_expected,
         refund_total   = (v_exp->>'refundTotal')::numeric,
         refund_count   = (v_exp->>'refundCount')::int,
         notes          = nullif(trim(p_notes), '')
   where id = v_row.id
   returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.close_cash_register(numeric, numeric, numeric, text) to authenticated;

-- ── Verify ────────────────────────────────────────────────────────────────
select 'cash_register_closings'      as obj, count(*)::text as rows from public.cash_register_closings
union all
select 'expected_totals_today',          (public.get_expected_totals())::text
union all
select 'open_register_today',            (public.open_cash_register()).business_date::text;
