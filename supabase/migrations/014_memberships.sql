-- ============================================================
-- GoKids Play — Smart Membership & Subscription Foundation
-- Migration 014
--
-- Four membership types, one table:
--
--   • unlimited  → pay once, unlimited entries until end_at; pauseable
--   • monthly    → recurring billing foundation; unlimited entries within window
--   • punch_pass → fixed `remaining_uses` (e.g. 10-entry card); not pauseable
--   • timed      → bounded by end_at only; not pauseable
--
-- Pause rules (unlimited only):
--   • While paused, the membership end_at is *extended* by the elapsed pause
--     seconds. The math lives in the pause/resume RPCs so the parent never
--     loses days they paid for.
--   • Pauses are recorded in `membership_pauses` for audit & analytics.
--
-- All money flows continue to use the existing wallet/payments tables —
-- memberships only track *entitlement*, not revenue (which already lives
-- in `payments`).
-- ============================================================

create table if not exists public.memberships (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid not null references public.parents(id) on delete cascade,
  /** Optional child binding — null = entire family covered. */
  child_id        uuid references public.children(id) on delete set null,

  type            text not null
                    check (type in ('unlimited', 'monthly', 'punch_pass', 'timed')),
  status          text not null default 'active'
                    check (status in ('active', 'paused', 'expired', 'cancelled')),

  started_at      timestamptz not null default now(),
  ends_at         timestamptz,
  /** When the latest pause began; null when not paused. */
  paused_at       timestamptz,
  /** Cumulative seconds spent paused — used to push ends_at out on resume. */
  paused_seconds  bigint not null default 0,

  /** For punch_pass: total entries originally granted. */
  total_uses      integer,
  /** For punch_pass: entries left. */
  remaining_uses  integer,

  /** Optional friendly note ("Yaz kampı", "Hediye"). */
  notes           text,

  /** Future subscription billing tag — "stripe", "iyzico", "manual"... */
  provider        text not null default 'manual',
  /** External subscription id (Stripe sub_xxx). */
  external_id     text,

  branch_id       uuid references public.branches(id) on delete set null,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One active row per (parent + type). Punch-pass behaves differently — you can
-- have *one* active punch pass at a time, then buy another after it runs out.
create unique index if not exists uq_one_active_membership_per_parent_type
  on public.memberships (parent_id, type)
  where status in ('active', 'paused');

create index if not exists idx_memberships_parent on public.memberships (parent_id);
create index if not exists idx_memberships_status on public.memberships (status);
create index if not exists idx_memberships_branch on public.memberships (branch_id);
create index if not exists idx_memberships_ends   on public.memberships (ends_at) where status in ('active', 'paused');

alter table public.memberships enable row level security;

drop policy if exists "branch scoped read" on public.memberships;
create policy "branch scoped read" on public.memberships
  for select to authenticated
  using (public.is_super_admin() or branch_id = public.current_branch());

drop policy if exists "branch scoped write" on public.memberships;
create policy "branch scoped write" on public.memberships
  for all to authenticated
  using (public.is_super_admin() or branch_id = public.current_branch())
  with check (public.is_super_admin() or branch_id = public.current_branch());

drop trigger if exists trg_set_branch on public.memberships;
create trigger trg_set_branch
  before insert on public.memberships
  for each row execute procedure public.set_branch_id_from_profile();

-- ─── Pauses (audit log) ───────────────────────────────────────────────────────

create table if not exists public.membership_pauses (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  paused_at     timestamptz not null default now(),
  resumed_at    timestamptz,
  /** Cached pause duration once resumed. */
  duration_seconds bigint,
  reason        text,
  paused_by     uuid references auth.users(id) on delete set null,
  paused_by_name text
);

create index if not exists idx_pauses_membership on public.membership_pauses (membership_id);
create index if not exists idx_pauses_active     on public.membership_pauses (resumed_at) where resumed_at is null;

alter table public.membership_pauses enable row level security;

drop policy if exists "branch scoped pauses" on public.membership_pauses;
create policy "branch scoped pauses" on public.membership_pauses
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.memberships m
      where m.id = membership_id and m.branch_id = public.current_branch()
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.memberships m
      where m.id = membership_id and m.branch_id = public.current_branch()
    )
  );

-- ─── RPC: create_membership ───────────────────────────────────────────────────

create or replace function public.create_membership(
  p_parent_id    uuid,
  p_child_id     uuid default null,
  p_type         text default 'unlimited',
  p_duration_days integer default 30,
  p_total_uses    integer default null,
  p_provider      text default 'manual',
  p_external_id   text default null,
  p_notes         text default null
) returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.memberships%rowtype;
  v_ends_at timestamptz;
begin
  if p_type not in ('unlimited', 'monthly', 'punch_pass', 'timed') then
    raise exception 'invalid_type';
  end if;

  -- Punch pass needs total_uses; others need a duration.
  if p_type = 'punch_pass' then
    if coalesce(p_total_uses, 0) <= 0 then
      raise exception 'punch_pass_requires_uses';
    end if;
    v_ends_at := null;  -- punch pass has no time boundary by default
  else
    if coalesce(p_duration_days, 0) <= 0 then
      raise exception 'invalid_duration';
    end if;
    v_ends_at := now() + make_interval(days => p_duration_days);
  end if;

  insert into public.memberships (
    parent_id, child_id, type, status,
    started_at, ends_at,
    total_uses, remaining_uses,
    notes, provider, external_id
  ) values (
    p_parent_id, p_child_id, p_type, 'active',
    now(), v_ends_at,
    p_total_uses, p_total_uses,
    p_notes, p_provider, p_external_id
  ) returning * into v_row;

  return v_row;
end;
$$;

-- ─── RPC: pause_membership (unlimited only) ───────────────────────────────────

create or replace function public.pause_membership(
  p_membership_id uuid,
  p_reason        text default null
) returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.memberships%rowtype;
  v_full_name text;
begin
  select * into v_row from public.memberships
    where id = p_membership_id for update;

  if v_row.id is null then raise exception 'membership_not_found'; end if;
  if v_row.type <> 'unlimited' then raise exception 'pause_only_unlimited'; end if;
  if v_row.status <> 'active'  then raise exception 'membership_not_active'; end if;

  select full_name into v_full_name from public.profiles where id = auth.uid();

  update public.memberships
    set status    = 'paused',
        paused_at = now(),
        updated_at = now()
    where id = p_membership_id
    returning * into v_row;

  insert into public.membership_pauses (membership_id, paused_at, reason, paused_by, paused_by_name)
    values (p_membership_id, now(), p_reason, auth.uid(), v_full_name);

  return v_row;
end;
$$;

-- ─── RPC: resume_membership ──────────────────────────────────────────────────
--
-- Extends ends_at by the elapsed pause duration so the parent doesn't lose
-- time they already paid for.

create or replace function public.resume_membership(
  p_membership_id uuid
) returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.memberships%rowtype;
  v_paused_at timestamptz;
  v_delta   bigint;
begin
  select * into v_row from public.memberships
    where id = p_membership_id for update;

  if v_row.id is null then raise exception 'membership_not_found'; end if;
  if v_row.status <> 'paused' then raise exception 'membership_not_paused'; end if;
  if v_row.paused_at is null then raise exception 'pause_state_corrupted'; end if;

  v_paused_at := v_row.paused_at;
  v_delta := extract(epoch from (now() - v_paused_at))::bigint;

  update public.memberships
    set status         = 'active',
        paused_at      = null,
        paused_seconds = paused_seconds + v_delta,
        ends_at        = case when ends_at is null then null
                              else ends_at + make_interval(secs => v_delta) end,
        updated_at     = now()
    where id = p_membership_id
    returning * into v_row;

  update public.membership_pauses
    set resumed_at = now(),
        duration_seconds = v_delta
    where membership_id = p_membership_id
      and resumed_at is null;

  return v_row;
end;
$$;

-- ─── RPC: consume_membership_use (punch_pass only) ───────────────────────────

create or replace function public.consume_membership_use(
  p_membership_id uuid
) returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.memberships%rowtype;
begin
  select * into v_row from public.memberships
    where id = p_membership_id for update;

  if v_row.id is null then raise exception 'membership_not_found'; end if;
  if v_row.type <> 'punch_pass' then raise exception 'not_punch_pass'; end if;
  if v_row.status <> 'active' then raise exception 'membership_not_active'; end if;
  if coalesce(v_row.remaining_uses, 0) <= 0 then raise exception 'no_uses_left'; end if;

  update public.memberships
    set remaining_uses = remaining_uses - 1,
        status         = case when remaining_uses - 1 <= 0 then 'expired' else 'active' end,
        updated_at     = now()
    where id = p_membership_id
    returning * into v_row;

  return v_row;
end;
$$;

-- ─── RPC: cancel_membership ──────────────────────────────────────────────────

create or replace function public.cancel_membership(
  p_membership_id uuid,
  p_reason text default 'manual'
) returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.memberships%rowtype;
begin
  update public.memberships
    set status     = 'cancelled',
        updated_at = now()
    where id = p_membership_id
      and status in ('active', 'paused')
    returning * into v_row;

  if v_row.id is null then raise exception 'membership_not_active'; end if;

  -- Resolve any open pause so the row stays consistent.
  update public.membership_pauses
    set resumed_at = now(),
        duration_seconds = extract(epoch from (now() - paused_at))::bigint
    where membership_id = p_membership_id
      and resumed_at is null;

  return v_row;
end;
$$;

-- ─── Maintenance: expire stale memberships ───────────────────────────────────

create or replace function public.expire_stale_memberships()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.memberships
      set status = 'expired',
          updated_at = now()
      where status in ('active', 'paused')
        and ends_at is not null
        and ends_at < now()
      returning 1
  )
  select count(*)::integer from expired;
$$;

-- ─── View: active membership stats (admin analytics) ─────────────────────────

create or replace view public.membership_analytics as
select
  branch_id,
  count(*)                                                            as total,
  count(*) filter (where status = 'active')                           as active_count,
  count(*) filter (where status = 'paused')                           as paused_count,
  count(*) filter (where status = 'expired')                          as expired_count,
  count(*) filter (where type = 'unlimited' and status in ('active','paused')) as unlimited_active,
  count(*) filter (where type = 'monthly'   and status in ('active','paused')) as monthly_active,
  count(*) filter (where type = 'punch_pass' and status in ('active'))         as punch_active,
  count(*) filter (
    where status in ('active', 'paused')
      and ends_at is not null
      and ends_at < now() + interval '7 days'
  ) as expiring_soon
from public.memberships
group by branch_id;

alter view public.membership_analytics set (security_invoker = true);

-- ============================================================
-- End of migration 014
-- ============================================================
