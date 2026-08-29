-- ─── 040 — Child attendance analytics (single source of truth) ──────────────
--
-- PRODUCTION-SAFE, ADDITIVE, READ-ONLY. Two new reporting RPCs. No existing
-- RPC, table, or row is modified.
--
-- Source of truth for child attendance = one `public.sessions` row per child
-- who entered the playground. Correct by construction:
--   • one session per child entry (parents are never sessions),
--   • extensions live in `session_extensions` (separate table) → never a second
--     session → extensions are not double-counted,
--   • retail sales live in `retail_sales` → never counted as attendance.
--
-- All day/hour bucketing uses Europe/Istanbul local time, so a calendar day
-- rolls over at 00:00 TR (Requirement 8).

-- ── 1. get_attendance_analytics — rich attendance rollup for a range ────────
create or replace function public.get_attendance_analytics(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns jsonb
language sql stable security definer set search_path = public
as $$
  with r as (
    select d_from, d_to from public._effective_range(p_from, p_to)
  ),
  att as (
    select s.child_id,
           (s.created_at at time zone 'Europe/Istanbul') as ts_local
    from public.sessions s, r
    where s.created_at >= r.d_from and s.created_at < r.d_to
      and (public.is_super_admin() or public.current_branch() is null
           or s.branch_id is null or s.branch_id = public.current_branch())
  ),
  base as (
    select count(*)::int total, count(distinct child_id)::int uniq,
           count(distinct ts_local::date)::int days
    from att
  ),
  firstret as (
    -- first-time = earliest EVER session is in range; else returning
    select
      count(*) filter (where first_ever >= (select d_from from r))::int first_time,
      count(*) filter (where first_ever <  (select d_from from r))::int returning_ct
    from (
      select child_id, min(created_at) first_ever
      from public.sessions
      where child_id in (select distinct child_id from att where child_id is not null)
      group by child_id
    ) fe
  ),
  byday as (select ts_local::date d, count(*)::int c from att group by 1),
  busy_day as (select jsonb_build_object('date', d::text, 'count', c) j from byday order by c desc, d desc limit 1),
  low_day  as (select jsonb_build_object('date', d::text, 'count', c) j from byday order by c asc,  d asc  limit 1),
  byhour as (select extract(hour from ts_local)::int h, count(*)::int c from att group by 1),
  busy_hour as (select jsonb_build_object('hour', h, 'count', c) j from byhour order by c desc limit 1),
  hourly as (
    select coalesce(jsonb_agg(jsonb_build_object('hour', hh, 'count', coalesce(g.c,0)) order by hh), '[]'::jsonb) j
    from generate_series(0,23) hh
    left join byhour g on g.h = hh
  ),
  we as (
    select
      count(*) filter (where extract(dow from ts_local) not in (0,6))::int weekday,
      count(*) filter (where extract(dow from ts_local) in (0,6))::int weekend
    from att
  )
  select jsonb_build_object(
    'total_entries',       (select total from base),
    'unique_children',     (select uniq from base),
    'returning_children',  (select returning_ct from firstret),
    'first_time_children', (select first_time from firstret),
    'active_days',         (select days from base),
    'avg_per_day',         (select case when days > 0 then round(total::numeric / days, 1) else 0 end from base),
    'busiest_day',         (select j from busy_day),
    'lowest_day',          (select j from low_day),
    'busiest_hour',        (select j from busy_hour),
    'hourly',              (select j from hourly),
    'weekday_entries',     (select weekday from we),
    'weekend_entries',     (select weekend from we)
  );
$$;

grant execute on function public.get_attendance_analytics(timestamptz, timestamptz) to authenticated;

-- ── 2. get_daily_traffic_revenue — per-day children + playground/retail rev ──
-- Output column is `bucket_day` (not `day`) and internal aliases are `gday`
-- to stay clear of the DAY keyword in the RETURNS TABLE / parser.
create or replace function public.get_daily_traffic_revenue(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns table(
  bucket_day         date,
  child_entries      integer,
  playground_revenue numeric,
  retail_revenue     numeric
)
language sql stable security definer set search_path = public
as $$
  with r as (select d_from, d_to from public._effective_range(p_from, p_to)),
  gs as (
    select generate_series(
      (select (d_from at time zone 'Europe/Istanbul')::date from r),
      (select (d_to   at time zone 'Europe/Istanbul')::date from r) - 1,
      interval '1 day'
    )::date as gday
  ),
  entries as (
    select (s.created_at at time zone 'Europe/Istanbul')::date gday, count(*) c
    from public.sessions s, r
    where s.created_at >= r.d_from and s.created_at < r.d_to
      and (public.is_super_admin() or public.current_branch() is null
           or s.branch_id is null or s.branch_id = public.current_branch())
    group by 1
  ),
  play as (
    select (p.created_at at time zone 'Europe/Istanbul')::date gday, sum(p.total_amount) amt
    from public.payments p, r
    where p.created_at >= r.d_from and p.created_at < r.d_to and p.session_id is not null
    group by 1
  ),
  retail as (
    select (rs.sold_at at time zone 'Europe/Istanbul')::date gday, sum(rs.total_amount) amt
    from public.retail_sales rs, r
    where rs.sold_at >= r.d_from and rs.sold_at < r.d_to and coalesce(rs.voided,false) = false
    group by 1
  )
  select gs.gday, coalesce(e.c,0)::int, coalesce(pl.amt,0)::numeric, coalesce(rt.amt,0)::numeric
  from gs
  left join entries e on e.gday = gs.gday
  left join play    pl on pl.gday = gs.gday
  left join retail  rt on rt.gday = gs.gday
  order by gs.gday;
$$;

grant execute on function public.get_daily_traffic_revenue(timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
