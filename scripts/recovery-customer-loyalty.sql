-- ─── Recovery: Customer Loyalty (migration 011 redo) ────────────────────────
--
-- Production audit found migration 011 was never applied. The original file
-- references gin_trgm_ops BEFORE creating the pg_trgm extension, so a
-- straight replay errors out. This recovery script:
--   1. Ensures pg_trgm is available first.
--   2. Applies the rest of 011 in dependency-safe order.
--   3. Is fully idempotent (safe to re-run).

-- ── 0. Extensions ─────────────────────────────────────────────────────────
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- ── 1. Parents extensions ─────────────────────────────────────────────────
alter table public.parents
  add column if not exists tags          text[]       not null default '{}',
  add column if not exists is_vip        boolean      not null default false,
  add column if not exists notes         text,
  add column if not exists last_visit_at timestamptz;

create index if not exists idx_parents_tags       on public.parents using gin (tags);
create index if not exists idx_parents_phone_trgm on public.parents using gin (phone gin_trgm_ops);
create index if not exists idx_parents_name_trgm  on public.parents using gin (full_name gin_trgm_ops);
create index if not exists idx_children_name_trgm on public.children using gin (name gin_trgm_ops);

-- ── 2. last_visit_at trigger + backfill ───────────────────────────────────
create or replace function public.touch_parent_last_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null then
    update public.parents
       set last_visit_at = greatest(coalesce(last_visit_at, '-infinity'::timestamptz), new.created_at)
     where id = new.parent_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_session_last_visit on public.sessions;
create trigger trg_session_last_visit
  after insert on public.sessions
  for each row execute procedure public.touch_parent_last_visit();

update public.parents p
   set last_visit_at = sub.last_at
  from (
    select parent_id, max(created_at) as last_at
      from public.sessions
     where parent_id is not null
     group by parent_id
  ) sub
 where p.id = sub.parent_id and p.last_visit_at is null;

-- ── 3. customer_summary view ──────────────────────────────────────────────
create or replace view public.customer_summary as
select
  p.id,
  p.full_name,
  p.phone,
  p.wallet_balance,
  p.tags,
  p.is_vip,
  p.notes,
  p.created_at as registered_at,
  p.last_visit_at,
  p.branch_id,
  coalesce(s.visit_count, 0)                  as visit_count,
  coalesce(s.completed_count, 0)              as completed_count,
  coalesce(s.last_session_at, p.last_visit_at) as last_session_at,
  coalesce(pay.total_spent, 0)                as total_spent,
  coalesce(pay.payment_count, 0)              as payment_count,
  coalesce(w.wallet_loaded, 0)                as wallet_loaded,
  coalesce(r.refund_total, 0)                 as refund_total,
  coalesce(r.refund_count, 0)                 as refund_count,
  coalesce(c.child_count, 0)                  as child_count
from public.parents p
left join (
  select parent_id,
         count(*)                                       as visit_count,
         count(*) filter (where status = 'completed')   as completed_count,
         max(created_at)                                as last_session_at
    from public.sessions
   where parent_id is not null
   group by parent_id
) s on s.parent_id = p.id
left join (
  select sess.parent_id,
         sum(pay.total_amount) as total_spent,
         count(*)              as payment_count
    from public.payments pay
    join public.sessions sess on sess.id = pay.session_id
   where sess.parent_id is not null
   group by sess.parent_id
) pay on pay.parent_id = p.id
left join (
  select parent_id,
         sum(amount) filter (where type = 'load') as wallet_loaded
    from public.wallet_transactions
   group by parent_id
) w on w.parent_id = p.id
left join (
  select parent_id,
         sum(refund_amount) as refund_total,
         count(*)           as refund_count
    from public.refund_logs
   where parent_id is not null
   group by parent_id
) r on r.parent_id = p.id
left join (
  select parent_id, count(*) as child_count
    from public.children
   group by parent_id
) c on c.parent_id = p.id;

alter view public.customer_summary set (security_invoker = true);

-- ── 4. customer_activity view ─────────────────────────────────────────────
create or replace view public.customer_activity as
-- Sessions (entry)
select
  s.id::text || '_sess' as id,
  'session_start'::text as kind,
  s.parent_id,
  s.branch_id,
  s.created_at          as occurred_at,
  jsonb_build_object(
    'session_id',  s.id,
    'child_name',  s.child_name,
    'duration',    s.duration_minutes,
    'status',      s.status
  ) as meta
from public.sessions s where s.parent_id is not null
union all
-- Payments
select
  pay.id::text || '_pay',
  'payment',
  sess.parent_id,
  sess.branch_id,
  pay.created_at,
  jsonb_build_object(
    'payment_id',  pay.id,
    'session_id',  pay.session_id,
    'total',       pay.total_amount,
    'cash',        pay.cash_amount,
    'card',        pay.card_amount,
    'wallet',      pay.wallet_amount
  )
from public.payments pay
join public.sessions sess on sess.id = pay.session_id
where sess.parent_id is not null
union all
-- Wallet load / debit
select
  wt.id::text || '_wal',
  'wallet_' || wt.type,
  wt.parent_id,
  null::uuid,
  wt.created_at,
  jsonb_build_object(
    'amount',    wt.amount,
    'reference', wt.reference_id,
    'note',      wt.note
  )
from public.wallet_transactions wt
where wt.parent_id is not null
union all
-- Refunds
select
  r.id::text || '_ref',
  'refund',
  r.parent_id,
  null::uuid,
  r.created_at,
  jsonb_build_object(
    'amount', r.refund_amount,
    'reason', r.reason
  )
from public.refund_logs r
where r.parent_id is not null
order by occurred_at desc;

alter view public.customer_activity set (security_invoker = true);

-- ── 5. RPCs ───────────────────────────────────────────────────────────────
create or replace function public.search_customers(
  p_query text,
  p_limit int default 12
) returns setof public.customer_summary
language sql
security invoker
set search_path = public
as $$
  with normalized as (
    select trim(coalesce(p_query, '')) as q
  )
  select * from public.customer_summary
   where case
           when (select length(q) from normalized) < 2 then false
           else
             full_name ilike '%' || (select q from normalized) || '%'
             or phone ilike '%' || (select q from normalized) || '%'
             or exists (
               select 1 from public.children c
                where c.parent_id = customer_summary.id
                  and c.name ilike '%' || (select q from normalized) || '%'
             )
         end
   order by last_visit_at desc nulls last
   limit p_limit;
$$;

grant execute on function public.search_customers(text, int) to authenticated;

create or replace function public.get_customer_profile(p_parent_id uuid)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_summary  public.customer_summary%rowtype;
  v_children json;
  v_activity json;
begin
  select * into v_summary from public.customer_summary where id = p_parent_id;
  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  select coalesce(json_agg(c.* order by c.created_at), '[]'::json)
    into v_children
    from (
      select id, name, age, allergies, created_at
        from public.children
       where parent_id = p_parent_id
       order by created_at
    ) c;

  select coalesce(json_agg(a.* order by a.occurred_at desc), '[]'::json)
    into v_activity
    from (
      select * from public.customer_activity
       where parent_id = p_parent_id
       order by occurred_at desc
       limit 50
    ) a;

  return json_build_object(
    'ok',       true,
    'summary',  row_to_json(v_summary),
    'children', v_children,
    'activity', v_activity
  );
end;
$$;

grant execute on function public.get_customer_profile(uuid) to authenticated;

create or replace function public.list_repeat_visitors(p_limit int default 8)
returns table (
  parent_id        uuid,
  full_name        text,
  phone            text,
  visit_count      bigint,
  total_spent      numeric,
  is_vip           boolean,
  last_session_at  timestamptz,
  today_visits     bigint
)
language sql
security invoker
set search_path = public
as $$
  with today_sessions as (
    select parent_id, count(*) as today_visits
      from public.sessions
     where parent_id is not null
       and date(created_at) = current_date
     group by parent_id
  )
  select
    cs.id,
    cs.full_name,
    cs.phone,
    cs.visit_count::bigint,
    cs.total_spent::numeric,
    cs.is_vip,
    cs.last_session_at,
    coalesce(ts.today_visits, 0)::bigint
  from public.customer_summary cs
  left join today_sessions ts on ts.parent_id = cs.id
  where cs.visit_count > 1
  order by cs.last_visit_at desc nulls last
  limit p_limit;
$$;

grant execute on function public.list_repeat_visitors(int) to authenticated;

-- ── 6. Tag management RPC ─────────────────────────────────────────────────
create or replace function public.set_customer_tag(
  p_parent_id uuid,
  p_tag       text,
  p_active    boolean
) returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_tags        text[];
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role not in ('admin','super_admin','manager') then
    raise exception 'forbidden';
  end if;

  if p_active then
    update public.parents
       set tags = array(select distinct unnest(tags || array[p_tag]))
     where id = p_parent_id
     returning tags into v_tags;
  else
    update public.parents
       set tags = array(select t from unnest(tags) t where t <> p_tag)
     where id = p_parent_id
     returning tags into v_tags;
  end if;

  return coalesce(v_tags, '{}'::text[]);
end;
$$;

grant execute on function public.set_customer_tag(uuid, text, boolean) to authenticated;

-- ── Verify ───────────────────────────────────────────────────────────────
select
  (select count(*) from public.customer_summary) as customers_in_view,
  (select count(*) from public.parents)          as parents_total,
  (select count(*) from public.sessions)         as sessions_total,
  (select count(*) from public.payments)         as payments_total;
