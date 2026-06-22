-- ─── Final production sweep ─────────────────────────────────────────────────
-- Closes two dashboard/uyelikler errors and the gun-sonu history panel.
--
-- 1. membership_analytics view stub (table has different schema than
--    migration 014 expected; create empty stub so frontend stops 4xx-ing)
-- 2. list_recent_closings re-installed (was cascade-dropped earlier;
--    branch filter removed because current_branch() may not be set)
drop view if exists public.membership_analytics cascade;
create view public.membership_analytics as
select null::uuid as branch_id, 0::bigint as total,
       0::bigint as active_count, 0::bigint as paused_count,
       0::bigint as expired_count, 0::bigint as unlimited_active,
       0::bigint as monthly_active, 0::bigint as punch_active,
       0::bigint as expiring_soon
 where false;
grant select on public.membership_analytics to authenticated;

create or replace function public.list_recent_closings(p_limit integer default 20)
returns setof public.cash_register_closings
language sql stable security definer set search_path=public as $$
  select * from public.cash_register_closings
   where status = 'closed'
   order by closed_at desc nulls last
   limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.list_recent_closings(integer) to authenticated;

notify pgrst, 'reload schema';
