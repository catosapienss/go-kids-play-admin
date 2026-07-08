-- ─── 028 — Fix "Gelir Dağılımı" empty chart (timezone bucketing) ────────────
--
-- BUG: get_revenue_breakdown bucketed days with date_trunc('day', created_at)
-- in the DB session timezone (UTC), while the client sends *local* (TR, UTC+3)
-- day boundaries. For the "Bugün" range this produced a series holding only
-- YESTERDAY (07 Tem) — because `date_trunc('day', d_to) - interval '1 day'`
-- assumes d_to is an exclusive next-midnight, but the client sends end-of-day
-- 23:59:59.999 — while today's payments bucketed to TODAY (08 Tem) in UTC.
-- The LEFT JOIN never matched → every cell rendered ₺0.
--
-- FIX: bucket AND build the day series in Europe/Istanbul local time, and make
-- the last series day inclusive by deriving it from (d_to - 1 microsecond).
-- This is correct for every preset regardless of whether `to` is end-of-day
-- (today / last7 / last30 / thisMonth / thisYear) or an exclusive midnight
-- (yesterday / lastMonth). Signature and result shape are unchanged.

create or replace function public.get_revenue_breakdown(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns table(
  day_date   date,
  cash       numeric(10,2),
  card       numeric(10,2),
  wallet     numeric(10,2),
  gross      numeric(10,2),
  refunds    numeric(10,2),
  net        numeric(10,2),
  tx_count   integer
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select * from public._effective_range(p_from, p_to)
  ),
  series as (
    select g::date as day_date
    from generate_series(
      date_trunc('day', (select d_from from bounds) at time zone 'Europe/Istanbul'),
      date_trunc('day', ((select d_to from bounds) - interval '1 microsecond') at time zone 'Europe/Istanbul'),
      interval '1 day'
    ) as g
  ),
  pay as (
    select
      (date_trunc('day', created_at at time zone 'Europe/Istanbul'))::date as day_date,
      sum(cash_amount)   as cash,
      sum(card_amount)   as card,
      sum(wallet_amount) as wallet,
      sum(total_amount)  as gross,
      count(*)           as tx_count
    from public.payments
    where created_at >= (select d_from from bounds)
      and created_at <  (select d_to   from bounds)
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
    group by (date_trunc('day', created_at at time zone 'Europe/Istanbul'))::date
  ),
  ref as (
    select
      (date_trunc('day', created_at at time zone 'Europe/Istanbul'))::date as day_date,
      sum(refund_amount) as refunds
    from public.refund_logs
    where created_at >= (select d_from from bounds)
      and created_at <  (select d_to   from bounds)
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
    group by (date_trunc('day', created_at at time zone 'Europe/Istanbul'))::date
  )
  select
    s.day_date,
    coalesce(p.cash, 0)::numeric(10,2)   as cash,
    coalesce(p.card, 0)::numeric(10,2)   as card,
    coalesce(p.wallet, 0)::numeric(10,2) as wallet,
    coalesce(p.gross, 0)::numeric(10,2)  as gross,
    coalesce(r.refunds, 0)::numeric(10,2) as refunds,
    (coalesce(p.gross, 0) - coalesce(r.refunds, 0))::numeric(10,2) as net,
    coalesce(p.tx_count, 0)::integer     as tx_count
  from series s
  left join pay  p on p.day_date = s.day_date
  left join ref  r on r.day_date = s.day_date
  order by s.day_date;
$$;

grant execute on function public.get_revenue_breakdown(timestamptz, timestamptz) to authenticated;
