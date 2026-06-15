-- ============================================================
-- GoKids Play — Customer History & Loyalty Foundation
-- Migration 011
--
-- Goals:
--   1. Tag system on `parents` (vip, frequent, organization, unlimited, …).
--   2. Pre-computed customer summary view (visits, spend, last visit, tags).
--   3. Unified customer activity view — union of sessions, payments, wallet
--      transactions, refunds, organizations — one timeline per parent.
--   4. Three high-leverage RPCs:
--        • search_customers(q)        — name / phone / child name in one call
--        • get_customer_profile(id)   — full profile in one round-trip
--        • list_repeat_visitors()     — dashboard "today's returning families"
--
-- The schema additions are nullable / default-zero so everything stays
-- backwards-compatible.
-- ============================================================

-- ─── 1. Parents extensions ────────────────────────────────────────────────────

alter table public.parents
  add column if not exists tags        text[] not null default '{}',
  add column if not exists is_vip      boolean not null default false,
  add column if not exists notes       text,
  add column if not exists last_visit_at timestamptz;

-- GIN index for fast tag filtering.
create index if not exists idx_parents_tags on public.parents using gin (tags);

-- Indexes that accelerate search.
create index if not exists idx_parents_phone_trgm on public.parents using gin (phone gin_trgm_ops);
create index if not exists idx_parents_name_trgm  on public.parents using gin (full_name gin_trgm_ops);
-- Children name trigram index for cross-table search.
create extension if not exists pg_trgm;
create index if not exists idx_children_name_trgm on public.children using gin (name gin_trgm_ops);

-- ─── 2. Trigger: keep last_visit_at fresh ─────────────────────────────────────

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

-- Backfill from existing sessions.
update public.parents p
  set last_visit_at = sub.last_at
  from (
    select parent_id, max(created_at) as last_at
    from public.sessions
    where parent_id is not null
    group by parent_id
  ) sub
  where p.id = sub.parent_id and p.last_visit_at is null;

-- ─── 3. Customer summary view ─────────────────────────────────────────────────
--
-- Pre-computes per-parent rollups. Manager dashboards + customer list reads
-- a single SELECT from this view. RLS on parents flows through automatically
-- since this is `security_invoker = true`.

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
  -- Aggregates
  coalesce(s.visit_count, 0)         as visit_count,
  coalesce(s.completed_count, 0)     as completed_count,
  coalesce(s.last_session_at, p.last_visit_at) as last_session_at,
  coalesce(pay.total_spent, 0)       as total_spent,
  coalesce(pay.payment_count, 0)     as payment_count,
  coalesce(w.wallet_loaded, 0)       as wallet_loaded,
  coalesce(r.refund_total, 0)        as refund_total,
  coalesce(r.refund_count, 0)        as refund_count,
  coalesce(c.child_count, 0)         as child_count
from public.parents p
left join (
  select parent_id,
         count(*) as visit_count,
         count(*) filter (where status = 'completed') as completed_count,
         max(created_at) as last_session_at
  from public.sessions
  where parent_id is not null
  group by parent_id
) s on s.parent_id = p.id
left join (
  -- Payments via session join (no direct parent_id on payments).
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

-- ─── 4. Customer activity view ────────────────────────────────────────────────
--
-- Unified timeline of every operational event tied to a parent. Each row has
-- a `kind` discriminator + a `meta` jsonb blob carrying type-specific detail.
-- The UI filters and renders accordingly.

create or replace view public.customer_activity as
-- Sessions (entry)
select
  s.id::text || '_sess' as id,
  'session_start'::text as kind,
  s.parent_id,
  s.branch_id,
  s.created_at as occurred_at,
  jsonb_build_object(
    'session_id',       s.id,
    'child_name',       s.child_name,
    'duration_minutes', s.duration_minutes,
    'staff_name',       s.staff_name,
    'status',           s.status
  ) as meta
from public.sessions s
where s.parent_id is not null

union all

-- Payments
select
  pay.id::text || '_pay' as id,
  'payment'::text       as kind,
  sess.parent_id,
  pay.branch_id,
  pay.created_at        as occurred_at,
  jsonb_build_object(
    'session_id',    pay.session_id,
    'total_amount',  pay.total_amount,
    'cash_amount',   pay.cash_amount,
    'card_amount',   pay.card_amount,
    'wallet_amount', pay.wallet_amount
  ) as meta
from public.payments pay
left join public.sessions sess on sess.id = pay.session_id
where sess.parent_id is not null

union all

-- Wallet transactions
select
  wt.id::text || '_w' as id,
  'wallet'::text     as kind,
  wt.parent_id,
  wt.branch_id,
  wt.created_at      as occurred_at,
  jsonb_build_object(
    'type',        wt.type,
    'amount',      wt.amount,
    'description', wt.description,
    'method',      wt.method
  ) as meta
from public.wallet_transactions wt
where wt.parent_id is not null

union all

-- Session extensions (mapped via sessions to find the parent)
select
  ex.id::text || '_ex' as id,
  'extension'::text   as kind,
  sess.parent_id,
  ex.branch_id,
  ex.created_at       as occurred_at,
  jsonb_build_object(
    'session_id',    ex.session_id,
    'added_minutes', ex.added_minutes,
    'amount',        ex.payment_amount,
    'payment_type',  ex.payment_type
  ) as meta
from public.session_extensions ex
left join public.sessions sess on sess.id = ex.session_id
where sess.parent_id is not null

union all

-- Refunds
select
  rl.id::text || '_r' as id,
  'refund'::text     as kind,
  rl.parent_id,
  rl.branch_id,
  rl.created_at      as occurred_at,
  jsonb_build_object(
    'session_id',   rl.session_id,
    'amount',       rl.refund_amount,
    'reason',       rl.refund_reason,
    'method',       rl.refund_method,
    'note',         rl.staff_note
  ) as meta
from public.refund_logs rl
where rl.parent_id is not null;

alter view public.customer_activity set (security_invoker = true);

-- ─── 5. RPC: search_customers ─────────────────────────────────────────────────
--
-- Single-shot search across name, phone, AND child name. Uses trigram indexes
-- so a 2-character query is fast even on a populated DB. Returns the summary
-- shape directly so the search UI can render rich result cards without a
-- second hydration call.

create or replace function public.search_customers(
  p_query text,
  p_limit integer default 12
) returns setof public.customer_summary
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := lower(coalesce(p_query, ''));
  v_q_norm text := regexp_replace(v_q, '\s+', '', 'g');
begin
  if length(v_q) < 2 then
    return query
      select * from public.customer_summary
      order by last_visit_at desc nulls last
      limit greatest(1, least(p_limit, 25));
    return;
  end if;

  return query
    select cs.*
    from public.customer_summary cs
    where (
      lower(cs.full_name) like '%' || v_q || '%'
      or regexp_replace(cs.phone, '\s+', '', 'g') like '%' || v_q_norm || '%'
      or exists (
        select 1 from public.children ch
        where ch.parent_id = cs.id and lower(ch.name) like '%' || v_q || '%'
      )
    )
    order by
      cs.is_vip desc,
      cs.visit_count desc,
      cs.last_visit_at desc nulls last
    limit greatest(1, least(p_limit, 25));
end;
$$;

-- ─── 6. RPC: get_customer_profile ─────────────────────────────────────────────
--
-- Returns the full profile in one call: summary + children + most recent
-- activity. Avoids a network waterfall on the profile screen.

create or replace function public.get_customer_profile(p_parent_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_summary  jsonb;
  v_children jsonb;
  v_activity jsonb;
begin
  select to_jsonb(cs) into v_summary
    from public.customer_summary cs
    where cs.id = p_parent_id;

  if v_summary is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb) into v_children
    from public.children c
    where c.parent_id = p_parent_id;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.occurred_at desc), '[]'::jsonb) into v_activity
    from (
      select * from public.customer_activity
      where parent_id = p_parent_id
      order by occurred_at desc
      limit 30
    ) a;

  return jsonb_build_object(
    'ok',       true,
    'summary',  v_summary,
    'children', v_children,
    'activity', v_activity
  );
end;
$$;

-- ─── 7. RPC: list_repeat_visitors ─────────────────────────────────────────────
--
-- "Today's returning families" — parents who have BOTH a session today AND
-- a session before today. Manager-facing dashboard insight; flags
-- familiar/loyal customers worth a smile.

create or replace function public.list_repeat_visitors(p_limit integer default 8)
returns table(
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
stable
security definer
set search_path = public
as $$
  with today_sessions as (
    select parent_id, count(*) as today_visits
    from public.sessions
    where created_at >= date_trunc('day', now())
      and parent_id is not null
    group by parent_id
  ),
  prior_sessions as (
    select distinct parent_id from public.sessions
    where created_at < date_trunc('day', now())
      and parent_id is not null
  )
  select
    cs.id          as parent_id,
    cs.full_name,
    cs.phone,
    cs.visit_count,
    cs.total_spent,
    cs.is_vip,
    cs.last_session_at,
    ts.today_visits
  from today_sessions ts
  join prior_sessions ps on ps.parent_id = ts.parent_id
  join public.customer_summary cs on cs.id = ts.parent_id
  order by cs.is_vip desc, cs.visit_count desc, ts.today_visits desc
  limit greatest(1, least(p_limit, 50));
$$;

-- ─── 8. RPC: set_customer_tag (manager-only tag toggle) ──────────────────────

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
  v_role text;
  v_tags text[];
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('super_admin', 'admin', 'manager') then
    raise exception 'forbidden';
  end if;

  if p_active then
    update public.parents
      set tags = case when p_tag = any(tags) then tags else array_append(tags, p_tag) end,
          is_vip = (case when p_tag = 'vip' then true else is_vip end)
      where id = p_parent_id
      returning tags into v_tags;
  else
    update public.parents
      set tags = array_remove(tags, p_tag),
          is_vip = (case when p_tag = 'vip' then false else is_vip end)
      where id = p_parent_id
      returning tags into v_tags;
  end if;

  return v_tags;
end;
$$;

-- ============================================================
-- End of migration 011
-- ============================================================
