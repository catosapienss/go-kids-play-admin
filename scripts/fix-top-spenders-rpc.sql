-- ─── Fix: En Çok Harcayanlar shows ₺0 for every customer ────────────────────
--
-- The previous get_customer_insights RPC returned `total_spent` in each
-- top_spenders row, but the frontend normaliser reads a `spent` key (and
-- also expects `visits` + `is_vip` which the RPC never returned).
--
-- Idempotent — safe to re-run.

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
    select sess.parent_id,
           sum(pay.total_amount) as total,
           count(distinct sess.id) as visits
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
    'top_spenders',     coalesce((
                          select json_agg(row_to_json(x))
                          from (
                            select p.id        as parent_id,
                                   p.full_name as full_name,
                                   p.phone     as phone,
                                   s.total     as spent,
                                   s.visits    as visits,
                                   coalesce(p.is_vip, false) as is_vip
                              from spend s
                              join public.parents p on p.id = s.parent_id
                             order by s.total desc
                             limit 5
                          ) x
                        ), '[]'::json)
  );
$$;

grant execute on function public.get_customer_insights(date, date) to authenticated;

notify pgrst, 'reload schema';
