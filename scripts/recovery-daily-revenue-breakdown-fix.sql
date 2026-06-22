-- Fix daily_revenue_breakdown for "Bugünkü Gelir" owner-dashboard widget.
-- Previous version: read sessions.total_price (column may be missing), used
-- UTC current_date, and skipped Quick Register income that lands in payments
-- + birthday deposits. After today's wipe+fix, all 4 buckets aggregate
-- correctly in TR timezone.
create or replace function public.daily_revenue_breakdown(p_date date default null)
returns json language plpgsql security definer set search_path=public as $$
declare
  v_target     date    := coalesce(p_date, public.tr_today());
  v_sessions   numeric := 0;
  v_retail     numeric := 0;
  v_birthdays  numeric := 0;
  v_memberships numeric := 0;
begin
  select coalesce(sum(p.total_amount), 0) into v_sessions
    from public.payments p
   where p.session_id is not null
     and (p.created_at at time zone 'Europe/Istanbul')::date = v_target;

  select coalesce(sum(total_amount), 0) into v_retail
    from public.retail_sales
   where not voided
     and (sold_at at time zone 'Europe/Istanbul')::date = v_target;

  begin
    select coalesce(sum(amount), 0) into v_birthdays
      from public.organization_payments
     where kind <> 'refund'
       and (created_at at time zone 'Europe/Istanbul')::date = v_target;
  exception when undefined_table then v_birthdays := 0;
  end;

  return json_build_object(
    'date',        v_target,
    'sessions',    v_sessions,
    'retail',      v_retail,
    'memberships', v_memberships,
    'birthdays',   v_birthdays,
    'total',       v_sessions + v_retail + v_memberships + v_birthdays
  );
end;
$$;
grant execute on function public.daily_revenue_breakdown(date) to authenticated;
notify pgrst, 'reload schema';
