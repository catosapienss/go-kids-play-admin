-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 036 — Membership & campaign reporting RPC (Phase 2)
--
-- Purely additive: one read-only SECURITY DEFINER function that aggregates the
-- membership + campaign figures for a date range. It NEVER counts promotional
-- bonus minutes as revenue — revenue = membership price + purchased (paid)
-- minutes only; bonus minutes are reported separately as a gifted quantity.
--
-- Safe for production: creates a function only. No table/row changes, no locks
-- on hot paths, no destructive DDL.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.membership_campaign_report(
  p_from timestamptz,
  p_to   timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_single       int := 0;
  v_sibling      int := 0;
  v_revenue      numeric := 0;
  v_camp_cnt     int := 0;
  v_camp_paid    int := 0;   -- purchased (paid) minutes on campaign sessions
  v_camp_bonus   int := 0;   -- gifted minutes — NEVER revenue
  v_mem_sessions int := 0;
  v_mem_weekday  int := 0;   -- weekday-unlimited membership visits
  v_mem_weekend  int := 0;   -- weekend membership minutes consumed
begin
  -- Package memberships sold in range → single vs sibling + revenue.
  -- Only package-backed memberships (migration 035) are counted here; the
  -- legacy unlimited/punch memberships are reported by the existing analytics.
  with sold as (
    select m.id,
           coalesce(m.price, 0) as price,
           (select count(*) from membership_children mc where mc.membership_id = m.id) as child_cnt
    from memberships m
    where m.package_id is not null
      and m.start_at >= p_from
      and m.start_at <  p_to
  )
  select
    coalesce(sum(case when child_cnt >= 2 then 0 else 1 end), 0),
    coalesce(sum(case when child_cnt >= 2 then 1 else 0 end), 0),
    coalesce(sum(price), 0)
  into v_single, v_sibling, v_revenue
  from sold;

  -- Campaign sessions in range → count + paid vs gifted minutes.
  select
    coalesce(count(*), 0),
    coalesce(sum(coalesce(s.purchased_minutes, 0)), 0),
    coalesce(sum(coalesce(s.bonus_minutes, 0)), 0)
  into v_camp_cnt, v_camp_paid, v_camp_bonus
  from sessions s
  where s.campaign_id is not null
    and s.start_time >= p_from
    and s.start_time <  p_to;

  -- Membership-backed sessions in range → weekday-unlimited visits vs weekend.
  -- Day-of-week bucketed in Europe/Istanbul (1..5 = Mon..Fri).
  select
    coalesce(count(*), 0),
    coalesce(sum(case when extract(dow from (s.start_time at time zone 'Europe/Istanbul')) between 1 and 5 then 1 else 0 end), 0)
  into v_mem_sessions, v_mem_weekday
  from sessions s
  where s.membership_id is not null
    and s.start_time >= p_from
    and s.start_time <  p_to;

  -- Weekend membership minutes actually consumed (per-child daily ledger).
  select coalesce(sum(mwu.minutes_used), 0)
  into v_mem_weekend
  from membership_weekend_usage mwu
  where mwu.usage_date >= (p_from at time zone 'Europe/Istanbul')::date
    and mwu.usage_date <  (p_to   at time zone 'Europe/Istanbul')::date;

  return jsonb_build_object(
    'memberships_single',        v_single,
    'memberships_sibling',       v_sibling,
    'memberships_sold',          v_single + v_sibling,
    'membership_revenue',        v_revenue,
    'campaign_sessions',         v_camp_cnt,
    'campaign_paid_minutes',     v_camp_paid,
    'campaign_bonus_minutes',    v_camp_bonus,
    'membership_sessions',       v_mem_sessions,
    'membership_weekday_visits', v_mem_weekday,
    'membership_weekend_minutes',v_mem_weekend
  );
end;
$$;

grant execute on function public.membership_campaign_report(timestamptz, timestamptz) to anon, authenticated, service_role;
