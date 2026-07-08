-- ─── 024 — FIX: reporting RPCs hard-hide null-branch rows ────────────────────
--
-- ROOT CAUSE of the empty "Yoğunluk Haritası", "Personel Performansı" and other
-- session-based report panels:
--   createSession never sets branch_id, so sessions.branch_id is always NULL.
--   The reporting RPCs filtered with
--     (is_super_admin() OR branch_id = current_branch())
--   For an admin (not super_admin) `branch_id = current_branch()` evaluates to
--   NULL for every null-branch row → the row is excluded → the panels read 0.
--   (Payment-based figures still showed because those rows carry a branch_id.)
--   This is the DB twin of the client-side withBranchScope fix (commit 40ad0fa).
--
-- FIX: make the branch predicate permissive when either side has no branch
-- (single-shop), while still scoping true multi-branch. Re-creates the affected
-- reporting functions verbatim with the corrected predicate. Idempotent.

create or replace function public.period_total(
  p_from timestamptz,
  p_to   timestamptz
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with pay as (
    select coalesce(sum(total_amount), 0)   as gross,
           coalesce(sum(cash_amount), 0)    as cash,
           coalesce(sum(card_amount), 0)    as card,
           coalesce(sum(wallet_amount), 0)  as wallet,
           count(*)                         as tx_count
    from public.payments
    where created_at >= p_from and created_at < p_to
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
  ),
  refunds as (
    select coalesce(sum(refund_amount), 0) as refunded
    from public.refund_logs
    where created_at >= p_from and created_at < p_to
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
  ),
  sessions as (
    select count(*) as session_count
    from public.sessions
    where created_at >= p_from and created_at < p_to
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
  )
  select jsonb_build_object(
    'gross',         (select gross from pay),
    'net',           (select gross from pay) - (select refunded from refunds),
    'cash',          (select cash from pay),
    'card',          (select card from pay),
    'wallet',        (select wallet from pay),
    'tx_count',      (select tx_count from pay),
    'refunded',      (select refunded from refunds),
    'session_count', (select session_count from sessions)
  );
$$;

-- ─── 2. Revenue breakdown over time (date-bucketed) ──────────────────────────
--
-- Returns one row per day in the range with cash / card / wallet / refund.
-- Used by the stacked area + line composition.

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
    select generate_series(
      (select date_trunc('day', d_from) from bounds),
      (select date_trunc('day', d_to)   from bounds) - interval '1 day',
      interval '1 day'
    )::date as day_date
  ),
  pay as (
    select
      date_trunc('day', created_at)::date as day_date,
      sum(cash_amount)   as cash,
      sum(card_amount)   as card,
      sum(wallet_amount) as wallet,
      sum(total_amount)  as gross,
      count(*)           as tx_count
    from public.payments
    where created_at >= (select d_from from bounds)
      and created_at <  (select d_to   from bounds)
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
    group by date_trunc('day', created_at)::date
  ),
  ref as (
    select
      date_trunc('day', created_at)::date as day_date,
      sum(refund_amount) as refunds
    from public.refund_logs
    where created_at >= (select d_from from bounds)
      and created_at <  (select d_to   from bounds)
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
    group by date_trunc('day', created_at)::date
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

-- ─── 3. Peak hours heatmap (day-of-week × hour) ──────────────────────────────

create or replace function public.get_peak_hours_heatmap(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns table(
  weekday  integer,    -- 0 = Sunday … 6 = Saturday (postgres DOW)
  hour     integer,    -- 0..23
  count    integer
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select coalesce(p_from, date_trunc('day', now()) - interval '30 days') as d_from,
           coalesce(p_to,   date_trunc('day', now()) + interval '1 day')   as d_to
  )
  select
    extract(dow  from created_at)::integer as weekday,
    extract(hour from created_at)::integer as hour,
    count(*)::integer                       as count
  from public.sessions
  where created_at >= (select d_from from bounds)
    and created_at <  (select d_to   from bounds)
    and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
  group by 1, 2
  order by 1, 2;
$$;

-- ─── 4. Customer insights aggregate ──────────────────────────────────────────

create or replace function public.get_customer_insights(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
  v_total_customers   integer;
  v_active_today      integer;
  v_returning         integer;
  v_returning_rate    numeric;
  v_vip_count         integer;
  v_avg_spend         numeric;
  v_total_visits      integer;
  v_top_spenders      jsonb;
begin
  select d_from, d_to into v_from, v_to from public._effective_range(p_from, p_to);

  select count(*) into v_total_customers
    from public.parents
    where (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch());

  -- Distinct parents who had at least one session in the date range.
  with active_parents as (
    select distinct parent_id
    from public.sessions
    where parent_id is not null
      and created_at >= v_from and created_at < v_to
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
  ),
  prior_parents as (
    select distinct parent_id
    from public.sessions
    where parent_id is not null
      and created_at < v_from
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
  )
  select count(*),
         count(*) filter (where parent_id in (select parent_id from prior_parents))
    into v_active_today, v_returning
    from active_parents;

  v_returning_rate := case when v_active_today = 0 then 0
                            else round(100.0 * v_returning / v_active_today, 1) end;

  select count(*) into v_vip_count
    from public.parents
    where is_vip = true
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch());

  select round(coalesce(avg(spend), 0), 2), coalesce(sum(visits), 0)::integer
    into v_avg_spend, v_total_visits
    from (
      select sess.parent_id,
             coalesce(sum(pay.total_amount), 0) as spend,
             count(*)                             as visits
      from public.sessions sess
      left join public.payments pay on pay.session_id = sess.id
      where sess.parent_id is not null
        and sess.created_at >= v_from and sess.created_at < v_to
        and (public.is_super_admin() or public.current_branch() is null or sess.branch_id is null or sess.branch_id = public.current_branch())
      group by sess.parent_id
    ) per_parent;

  select coalesce(jsonb_agg(jsonb_build_object(
    'parent_id', cs.id,
    'full_name', cs.full_name,
    'phone',     cs.phone,
    'visits',    cs.visit_count,
    'spent',     cs.total_spent,
    'is_vip',    cs.is_vip
  ) order by cs.total_spent desc), '[]'::jsonb)
    into v_top_spenders
    from (
      select id, full_name, phone, visit_count, total_spent, is_vip
      from public.customer_summary
      order by total_spent desc nulls last
      limit 10
    ) cs;

  return jsonb_build_object(
    'total_customers', v_total_customers,
    'active_in_range', v_active_today,
    'returning',       v_returning,
    'returning_rate',  v_returning_rate,
    'vip_count',       v_vip_count,
    'vip_ratio',       case when v_total_customers = 0 then 0
                            else round(100.0 * v_vip_count / v_total_customers, 1) end,
    'avg_spend',       v_avg_spend,
    'total_visits',    v_total_visits,
    'top_spenders',    v_top_spenders
  );
end;
$$;

-- ─── 5. Organization analytics ───────────────────────────────────────────────
--
-- Best-effort — the organizations table may not exist on a fresh DB.

create or replace function public.get_organization_analytics(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
  v_count        integer := 0;
  v_avg_children numeric := 0;
  v_revenue      numeric := 0;
  v_upcoming     integer := 0;
  v_busy_days    jsonb   := '[]'::jsonb;
begin
  select d_from, d_to into v_from, v_to
    from public._effective_range(p_from, p_to);

  begin
    select count(*),
           coalesce(round(avg(child_count), 1), 0),
           coalesce(sum(total_amount), 0)
      into v_count, v_avg_children, v_revenue
      from public.organizations
      where event_date >= v_from and event_date < v_to
        and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch());

    select count(*) into v_upcoming
      from public.organizations
      where event_date >= now()
        and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch());

    select coalesce(jsonb_agg(jsonb_build_object(
      'date',  to_char(d, 'YYYY-MM-DD'),
      'count', n
    ) order by n desc), '[]'::jsonb) into v_busy_days
      from (
        select date_trunc('day', event_date)::date as d, count(*) as n
        from public.organizations
        where event_date >= v_from and event_date < v_to
          and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
        group by 1
        order by 2 desc
        limit 5
      ) busy;
  exception when undefined_table then
    -- Organizations table not yet created — return zeroed shape.
    null;
  end;

  return jsonb_build_object(
    'count',        v_count,
    'avg_children', v_avg_children,
    'revenue',      v_revenue,
    'upcoming',     v_upcoming,
    'busy_days',    v_busy_days
  );
end;
$$;

-- ─── 6. Package performance ──────────────────────────────────────────────────

create or replace function public.get_package_performance(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
  v_buckets jsonb;
  v_unlimited_share numeric := 0;
  v_extension_rate  numeric := 0;
  v_avg_duration    numeric := 0;
begin
  select d_from, d_to into v_from, v_to from public._effective_range(p_from, p_to);

  with rows as (
    select
      case
        when duration_minutes = 0  then 'Sınırsız'
        when duration_minutes <= 30 then '30dk'
        when duration_minutes <= 60 then '60dk'
        else '90dk'
      end as bucket,
      duration_minutes
    from public.sessions
    where created_at >= v_from and created_at < v_to
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
  )
  select
    coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'count', cnt)
      order by case bucket when '30dk' then 1 when '60dk' then 2 when '90dk' then 3 else 4 end), '[]'::jsonb)
    into v_buckets
    from (
      select bucket, count(*) as cnt from rows group by bucket
    ) g;

  select
    coalesce(round(100.0 * count(*) filter (where duration_minutes = 0) / nullif(count(*), 0), 1), 0)
    into v_unlimited_share
    from public.sessions
    where created_at >= v_from and created_at < v_to
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch());

  select coalesce(round(avg(duration_minutes), 1), 0)
    into v_avg_duration
    from public.sessions
    where created_at >= v_from and created_at < v_to
      and duration_minutes > 0
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch());

  with sess_total as (
    select count(*) as n from public.sessions
      where created_at >= v_from and created_at < v_to
        and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
  ),
  ext_uniq as (
    select count(distinct session_id) as n from public.session_extensions
      where created_at >= v_from and created_at < v_to
        and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
  )
  select case when (select n from sess_total) = 0 then 0
              else round(100.0 * (select n from ext_uniq) / (select n from sess_total), 1) end
    into v_extension_rate;

  return jsonb_build_object(
    'buckets',         v_buckets,
    'unlimited_share', v_unlimited_share,
    'extension_rate',  v_extension_rate,
    'avg_duration',    v_avg_duration
  );
end;
$$;

-- ─── 7. Staff performance over a date range ──────────────────────────────────

create or replace function public.get_staff_performance(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns table(
  staff_name        text,
  session_count     integer,
  refund_count      integer,
  active_seconds    bigint,
  refund_rate       numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select * from public._effective_range(p_from, p_to)
  ),
  sessions_by_staff as (
    select coalesce(staff_name, '—') as staff_name, count(*) as n
    from public.sessions
    where created_at >= (select d_from from bounds)
      and created_at <  (select d_to   from bounds)
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
    group by 1
  ),
  refunds_by_staff as (
    select coalesce(staff_note, '—') as staff_name, count(*) as n
    from public.refund_logs
    where created_at >= (select d_from from bounds)
      and created_at <  (select d_to   from bounds)
      and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
    group by 1
  ),
  shifts_by_staff as (
    select coalesce(p.full_name, '—') as staff_name,
           sum(coalesce(s.duration_seconds, extract(epoch from (now() - s.started_at))::integer))::bigint as active_seconds
    from public.staff_shifts s
    left join public.profiles p on p.id = s.user_id
    where s.started_at >= (select d_from from bounds)
      and s.started_at <  (select d_to   from bounds)
      and (public.is_super_admin() or public.current_branch() is null or s.branch_id is null or s.branch_id = public.current_branch())
    group by coalesce(p.full_name, '—')
  )
  select
    coalesce(sb.staff_name, rb.staff_name, sh.staff_name) as staff_name,
    coalesce(sb.n, 0)::integer  as session_count,
    coalesce(rb.n, 0)::integer  as refund_count,
    coalesce(sh.active_seconds, 0)::bigint as active_seconds,
    case when coalesce(sb.n, 0) = 0 then 0::numeric
         else round(100.0 * coalesce(rb.n, 0) / sb.n, 1) end as refund_rate
  from sessions_by_staff sb
  full outer join refunds_by_staff rb on rb.staff_name = sb.staff_name
  full outer join shifts_by_staff  sh on sh.staff_name = coalesce(sb.staff_name, rb.staff_name)
  order by coalesce(sb.n, 0) desc
  limit 20;
$$;

-- ============================================================
-- End of migration 012
-- ============================================================
