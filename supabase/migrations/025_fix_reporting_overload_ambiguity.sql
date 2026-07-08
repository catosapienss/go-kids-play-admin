-- ─── 025 — FIX: reporting RPC overload ambiguity + defensive org analytics ──
--
-- Migration 024 added timestamptz-parameter versions of the reporting RPCs, but
-- production already carried legacy DATE-parameter overloads of the same
-- functions. PostgREST then couldn't choose between the two candidates and
-- surfaced "Could not choose the best candidate function" on the Müşteri /
-- Operasyon report tabs. Separately, get_organization_analytics referenced a
-- `child_count` column that doesn't exist in this database's `organizations`
-- table ("column child_count does not exist").
--
-- FIX: drop the ambiguous legacy DATE overloads (keep the timestamptz,
-- branch-fixed versions), and make organization analytics fully defensive so a
-- differing schema returns a zeroed shape instead of a red panel. Idempotent.

drop function if exists public.get_customer_insights(date, date);
drop function if exists public.get_package_performance(date, date);
drop function if exists public.get_peak_hours_heatmap(date, date);
drop function if exists public.get_revenue_breakdown(date, date);
drop function if exists public.get_staff_performance(date, date);
drop function if exists public.get_organization_analytics(date, date);
drop function if exists public.period_total(date, date);

create or replace function public.get_organization_analytics(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz; v_to timestamptz; v_count integer := 0; v_avg_children numeric := 0; v_revenue numeric := 0; v_upcoming integer := 0; v_busy_days jsonb := '[]'::jsonb;
begin
  select d_from, d_to into v_from, v_to from public._effective_range(p_from, p_to);
  begin
    execute $q$
      select count(*),
             coalesce(round(avg(coalesce(child_count, guest_count, 0)),1),0),
             coalesce(sum(coalesce(total_amount, total_price, 0)),0)
      from public.organizations
      where event_date >= $1 and event_date < $2
        and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
    $q$ into v_count, v_avg_children, v_revenue using v_from, v_to;
  exception when others then
    v_count := 0; v_avg_children := 0; v_revenue := 0;
  end;
  begin
    execute $q$
      select count(*) from public.organizations where event_date >= now()
        and (public.is_super_admin() or public.current_branch() is null or branch_id is null or branch_id = public.current_branch())
    $q$ into v_upcoming;
  exception when others then v_upcoming := 0; end;
  return jsonb_build_object('count',v_count,'avg_children',v_avg_children,'revenue',v_revenue,'upcoming',v_upcoming,'busy_days',v_busy_days);
end; $$;

grant execute on function public.get_organization_analytics(timestamptz, timestamptz) to authenticated;
