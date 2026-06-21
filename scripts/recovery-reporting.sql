-- ─── Recovery — Reporting + Day-End RPC suite ─────────────────────────────
--
-- Migrations 010 (staff_shifts) and 012 (reporting) never ran in production.
-- /raporlar and /gun-sonu rely on RPCs from those migrations, so the screens
-- always render "₺0" (safeReadRpc swallows the missing-function error and
-- returns its fallback).
--
-- This script creates minimal, schema-correct stubs + the four core report
-- RPCs reading directly from payments + sessions. Idempotent.

create extension if not exists pgcrypto;

-- ── 1. branch_id columns referenced by 012 ─────────────────────────────────
alter table public.payments            add column if not exists branch_id uuid;
alter table public.refund_logs         add column if not exists branch_id uuid;
alter table public.wallet_transactions add column if not exists branch_id uuid;
alter table public.children            add column if not exists branch_id uuid;

-- ── 2. Dependency table stubs ──────────────────────────────────────────────
create table if not exists public.staff_shifts (
  id              uuid primary key default gen_random_uuid(),
  staff_name      text,
  start_time      timestamptz default now(),
  end_time        timestamptz,
  duration_minutes int,
  branch_id       uuid,
  created_at      timestamptz default now()
);
alter table public.staff_shifts enable row level security;
drop policy if exists "staff_shifts read" on public.staff_shifts;
create policy "staff_shifts read"
  on public.staff_shifts for select to authenticated using (true);

create table if not exists public.session_extensions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references public.sessions(id) on delete cascade,
  added_minutes int not null default 0,
  reason        text,
  branch_id     uuid,
  created_at    timestamptz default now()
);
alter table public.session_extensions enable row level security;
drop policy if exists "session_extensions read" on public.session_extensions;
create policy "session_extensions read"
  on public.session_extensions for select to authenticated using (true);

-- ── 3. Revenue periods (Bugün / Son 7 gün / Son 30 gün / Son 365 gün) ─────
create or replace function public.get_revenue_periods()
returns json
language sql security definer
set search_path = public
as $$
  with daily as (
    select date(created_at) as d, sum(total_amount)::numeric as v
      from public.payments
     group by 1
  )
  select json_build_object(
    'today',     coalesce((select v from daily where d = current_date), 0),
    'yesterday', coalesce((select v from daily where d = current_date - 1), 0),
    'week',      coalesce((select sum(v) from daily where d >= current_date - 6), 0),
    'prevWeek',  coalesce((select sum(v) from daily where d between current_date - 13 and current_date - 7), 0),
    'month',     coalesce((select sum(v) from daily where d >= current_date - 29), 0),
    'prevMonth', coalesce((select sum(v) from daily where d between current_date - 59 and current_date - 30), 0),
    'year',      coalesce((select sum(v) from daily where d >= current_date - 364), 0)
  );
$$;
grant execute on function public.get_revenue_periods() to authenticated;

-- ── 4. Revenue breakdown (per-day, cash/card/wallet) ───────────────────────
create or replace function public.get_revenue_breakdown(
  p_from date default current_date - 6,
  p_to   date default current_date
)
returns table (day date, cash numeric, card numeric, wallet numeric, total numeric)
language sql security definer
set search_path = public
as $$
  select date(created_at) as day,
         coalesce(sum(cash_amount), 0)::numeric,
         coalesce(sum(card_amount), 0)::numeric,
         coalesce(sum(wallet_amount), 0)::numeric,
         coalesce(sum(total_amount), 0)::numeric
    from public.payments
   where date(created_at) between p_from and p_to
   group by 1
   order by 1;
$$;
grant execute on function public.get_revenue_breakdown(date, date) to authenticated;

-- ── 5. Peak hours heatmap ──────────────────────────────────────────────────
create or replace function public.get_peak_hours_heatmap(
  p_from date default current_date - 6,
  p_to   date default current_date
)
returns table (dow int, hour int, sessions bigint, revenue numeric)
language sql security definer
set search_path = public
as $$
  select extract(dow  from s.created_at)::int,
         extract(hour from s.created_at)::int,
         count(*)::bigint,
         coalesce(sum(p.total_amount), 0)::numeric
    from public.sessions s
    left join public.payments p on p.session_id = s.id
   where date(s.created_at) between p_from and p_to
   group by 1, 2;
$$;
grant execute on function public.get_peak_hours_heatmap(date, date) to authenticated;

-- ── 6. Customer insights ───────────────────────────────────────────────────
create or replace function public.get_customer_insights(
  p_from date default current_date - 29,
  p_to   date default current_date
)
returns json
language sql security definer
set search_path = public
as $$
  with active as (
    select distinct parent_id from public.sessions
     where parent_id is not null and date(created_at) between p_from and p_to
  ),
  returning_p as (
    select parent_id from public.sessions
     where parent_id is not null group by parent_id having count(*) > 1
  ),
  spend as (
    select sess.parent_id, sum(pay.total_amount) as total
      from public.payments pay
      join public.sessions sess on sess.id = pay.session_id
     where sess.parent_id is not null
     group by sess.parent_id
  )
  select json_build_object(
    'total_customers',  (select count(*) from public.parents),
    'active_in_range',  (select count(*) from active),
    'returning',        (select count(*) from returning_p),
    'returning_rate',   case when (select count(*) from public.parents) > 0
                          then (select count(*) from returning_p)::numeric * 100
                               / (select count(*) from public.parents)
                          else 0 end,
    'vip_count',        coalesce((select count(*) from public.parents where is_vip), 0),
    'vip_ratio',        case when (select count(*) from public.parents) > 0
                          then coalesce((select count(*) from public.parents where is_vip), 0)::numeric * 100
                               / (select count(*) from public.parents)
                          else 0 end,
    'avg_spend',        coalesce((select avg(total) from spend), 0),
    'total_visits',     (select count(*) from public.sessions),
    'top_spenders',     coalesce((select json_agg(json_build_object(
                          'parent_id',   p.id,
                          'full_name',   p.full_name,
                          'phone',       p.phone,
                          'total_spent', s.total))
                          from spend s
                          join public.parents p on p.id = s.parent_id
                          order by s.total desc limit 5), '[]'::json)
  );
$$;
grant execute on function public.get_customer_insights(date, date) to authenticated;

-- ── 7. Auxiliary RPCs (return empty arrays so panels don't crash) ──────────
create or replace function public.get_org_analytics(
  p_from date default current_date - 29,
  p_to   date default current_date
)
returns json language sql security definer set search_path = public as $$
  select coalesce((select json_agg(o) from (
    select status, count(*) as count
      from public.organizations
     where date(event_date) between p_from and p_to
     group by status
  ) o), '[]'::json);
$$;
grant execute on function public.get_org_analytics(date, date) to authenticated;

create or replace function public.get_staff_performance(
  p_from date default current_date - 29,
  p_to   date default current_date
)
returns json language sql security definer set search_path = public as $$
  select coalesce((select json_agg(t) from (
    select staff_name, count(*) as sessions
      from public.sessions
     where staff_name is not null and date(created_at) between p_from and p_to
     group by staff_name
     order by 2 desc limit 20
  ) t), '[]'::json);
$$;
grant execute on function public.get_staff_performance(date, date) to authenticated;

create or replace function public.get_package_performance(
  p_from date default current_date - 29,
  p_to   date default current_date
)
returns json language sql security definer set search_path = public as $$
  select coalesce((select json_agg(t) from (
    select case when duration_minutes = 0 then 'Serbest'
                else duration_minutes::text || ' dk' end as package,
           count(*) as sessions
      from public.sessions
     where date(created_at) between p_from and p_to
     group by 1 order by 2 desc
  ) t), '[]'::json);
$$;
grant execute on function public.get_package_performance(date, date) to authenticated;

create or replace function public.get_day_end_summary(p_date date default current_date)
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'date',          p_date,
    'cash',          coalesce((select sum(cash_amount)   from public.payments where date(created_at) = p_date), 0),
    'card',          coalesce((select sum(card_amount)   from public.payments where date(created_at) = p_date), 0),
    'wallet',        coalesce((select sum(wallet_amount) from public.payments where date(created_at) = p_date), 0),
    'total',         coalesce((select sum(total_amount)  from public.payments where date(created_at) = p_date), 0),
    'session_count', (select count(*) from public.sessions where date(created_at) = p_date),
    'payment_count', (select count(*) from public.payments where date(created_at) = p_date)
  );
$$;
grant execute on function public.get_day_end_summary(date) to authenticated;

-- ── Verify ────────────────────────────────────────────────────────────────
select 'reporting RPCs ready' as status,
       (public.get_revenue_periods())::text as revenue_periods_now;
