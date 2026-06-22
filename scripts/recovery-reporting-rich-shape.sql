-- ─── Reporting RPCs return the full PeriodTotal / RevenueDayPoint shape ────
--
-- Earlier patches collapsed periods into bare numbers. The frontend
-- expects { gross, net, cash, card, wallet, tx_count, refunded,
-- session_count } per period.  Empty cards (₺0) and "Invalid Date" on
-- the chart were the symptom.
--
-- Source of truth:
--   • src/types/reports.ts → RawPeriodTotal, DbRevenueDayRow

-- ── 1. tr_today() — TR timezone date helper ─────────────────────────────────
create or replace function public.tr_today()
returns date language sql stable as $$
  select (now() at time zone 'Europe/Istanbul')::date
$$;
grant execute on function public.tr_today() to authenticated;

-- ── 2. Helper view: unified daily totals across payments + retail_sales ─────
create or replace view public.v_daily_revenue as
  with pay as (
    select (created_at at time zone 'Europe/Istanbul')::date as d,
           coalesce(sum(cash_amount),0)::numeric   as cash,
           coalesce(sum(card_amount),0)::numeric   as card,
           coalesce(sum(wallet_amount),0)::numeric as wallet,
           coalesce(sum(total_amount),0)::numeric  as total,
           count(*)::int as tx_count
      from public.payments
     group by 1
  ),
  ret as (
    select (sold_at at time zone 'Europe/Istanbul')::date as d,
           coalesce(sum(cash_amount),0)::numeric as cash,
           coalesce(sum(card_amount),0)::numeric as card,
           0::numeric                             as wallet,
           coalesce(sum(total_amount),0)::numeric as total,
           count(*)::int as tx_count
      from public.retail_sales
     where not voided
     group by 1
  ),
  ses as (
    select (created_at at time zone 'Europe/Istanbul')::date as d,
           count(*)::int as session_count
      from public.sessions
     group by 1
  ),
  unioned as (
    select d, cash, card, wallet, total, tx_count from pay
    union all
    select d, cash, card, wallet, total, tx_count from ret
  )
  select coalesce(u.d, ses.d) as d,
         coalesce(sum(u.cash),0)::numeric    as cash,
         coalesce(sum(u.card),0)::numeric    as card,
         coalesce(sum(u.wallet),0)::numeric  as wallet,
         coalesce(sum(u.total),0)::numeric   as total,
         coalesce(sum(u.tx_count),0)::int    as tx_count,
         coalesce(max(ses.session_count),0)::int as session_count
    from unioned u
    full outer join ses on ses.d = u.d
   group by coalesce(u.d, ses.d);

grant select on public.v_daily_revenue to authenticated;

-- ── 3. get_revenue_periods — rich PeriodTotal shape ─────────────────────────
create or replace function public.get_revenue_periods()
returns json language sql security definer set search_path=public as $$
  with bounds as (
    select public.tr_today() as today
  ),
  buckets as (
    select 'today'      as k, today as lo,            today as hi          from bounds
    union all select 'yesterday', today - 1,         today - 1            from bounds
    union all select 'week',      today - 6,         today                from bounds
    union all select 'prev_week', today - 13,        today - 7            from bounds
    union all select 'month',     today - 29,        today                from bounds
    union all select 'prev_month',today - 59,        today - 30           from bounds
    union all select 'year',      today - 364,       today                from bounds
  ),
  agg as (
    select b.k,
           coalesce(sum(d.total),    0)::numeric as gross,
           coalesce(sum(d.cash),     0)::numeric as cash,
           coalesce(sum(d.card),     0)::numeric as card,
           coalesce(sum(d.wallet),   0)::numeric as wallet,
           coalesce(sum(d.tx_count), 0)::int     as tx_count,
           coalesce(sum(d.session_count), 0)::int as session_count
      from buckets b
      left join public.v_daily_revenue d on d.d between b.lo and b.hi
     group by b.k
  ),
  obj as (
    select k,
           json_build_object(
             'gross', gross,
             'net',   gross,
             'cash',  cash,
             'card',  card,
             'wallet',wallet,
             'tx_count', tx_count,
             'refunded', 0,
             'session_count', session_count
           ) as v
      from agg
  )
  select json_object_agg(k, v) from obj;
$$;
grant execute on function public.get_revenue_periods() to authenticated;

-- ── 4. get_revenue_breakdown — per-day rows for the chart ───────────────────
create or replace function public.get_revenue_breakdown(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns table (
  day_date date,
  cash     numeric,
  card     numeric,
  wallet   numeric,
  gross    numeric,
  refunds  numeric,
  net      numeric,
  tx_count int
) language sql security definer set search_path=public as $$
  with rng as (
    select coalesce((p_from at time zone 'Europe/Istanbul')::date,
                    public.tr_today() - 29) as lo,
           coalesce((p_to   at time zone 'Europe/Istanbul')::date,
                    public.tr_today())       as hi
  ),
  days as (
    select generate_series(lo, hi, interval '1 day')::date as d
      from rng
  )
  select dy.d                            as day_date,
         coalesce(v.cash, 0)::numeric    as cash,
         coalesce(v.card, 0)::numeric    as card,
         coalesce(v.wallet, 0)::numeric  as wallet,
         coalesce(v.total, 0)::numeric   as gross,
         0::numeric                       as refunds,
         coalesce(v.total, 0)::numeric   as net,
         coalesce(v.tx_count, 0)::int    as tx_count
    from days dy
    left join public.v_daily_revenue v on v.d = dy.d
   order by dy.d asc;
$$;
grant execute on function public.get_revenue_breakdown(timestamptz, timestamptz) to authenticated;

-- ── 5. Sanity output ────────────────────────────────────────────────────────
select 'rich reporting RPCs installed' as status,
       (public.get_revenue_periods())::text as periods,
       (select count(*) from public.get_revenue_breakdown()) as breakdown_rows;
