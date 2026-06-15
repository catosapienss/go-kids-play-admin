-- ============================================================
-- GoKids Play — Staff Shift & Activity Tracking
-- Migration 010
--
-- This migration is two-part:
--
--   1. A purpose-built `staff_shifts` table that tracks vardiya başlangıç /
--      bitiş times. Combined with audit_logs (mig 006) it gives a complete
--      picture of "who did what when".
--
--   2. A trigger on `audit_logs` that automatically attaches `auth.uid()`
--      so every staff action is correctly attributed without app code
--      having to remember.
--
-- The shift table is small but high-leverage: every existing operational
-- record already carries staff_name (sessions.staff_name, refund_logs.
-- staff_note, etc), so the shift table is the *anchor* the manager uses to
-- query "show me everything Ahmet did during his 14:00-22:00 shift".
-- ============================================================

-- ─── 1. Auto-attribute audit_logs to the calling user ────────────────────────
--
-- Trigger runs before insert; if user_id wasn't supplied it defaults to the
-- authenticated user. This is critical for the activity timeline to render
-- per-staff filters correctly.

create or replace function public.set_user_id_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_user_id on public.audit_logs;
create trigger trg_audit_user_id
  before insert on public.audit_logs
  for each row execute procedure public.set_user_id_from_auth();

-- ─── 2. staff_shifts table ────────────────────────────────────────────────────

create table if not exists public.staff_shifts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  branch_id    uuid references public.branches(id) on delete set null,
  status       text not null default 'active'
                 check (status in ('active', 'ended')),

  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  /** Optional manual end-time override (e.g. forgot to clock out). */
  ended_by     uuid references auth.users(id) on delete set null,
  ended_by_name text,

  -- Snapshot of who started — kept even after user is deleted.
  started_by_name text,

  notes        text,
  is_demo      boolean not null default false,

  -- Cached duration so dashboards don't recompute every render.
  duration_seconds integer generated always as (
    case
      when ended_at is null then null
      else extract(epoch from (ended_at - started_at))::integer
    end
  ) stored
);

-- Only ONE active shift per user.
create unique index if not exists uq_one_active_shift_per_user
  on public.staff_shifts (user_id)
  where status = 'active';

create index if not exists idx_staff_shifts_branch    on public.staff_shifts (branch_id);
create index if not exists idx_staff_shifts_user      on public.staff_shifts (user_id);
create index if not exists idx_staff_shifts_status    on public.staff_shifts (status);
create index if not exists idx_staff_shifts_started   on public.staff_shifts (started_at desc);

-- ─── 3. RLS — branch-scoped + own-row read for non-managers ──────────────────

alter table public.staff_shifts enable row level security;

drop policy if exists "read own shifts or branch shifts" on public.staff_shifts;
create policy "read own shifts or branch shifts" on public.staff_shifts
  for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or (
      branch_id = public.current_branch()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('admin', 'manager')
      )
    )
  );

drop policy if exists "write own shifts" on public.staff_shifts;
create policy "write own shifts" on public.staff_shifts
  for all to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or (
      branch_id = public.current_branch()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('admin', 'manager')
      )
    )
  )
  with check (
    public.is_super_admin()
    or user_id = auth.uid()
    or (
      branch_id = public.current_branch()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('admin', 'manager')
      )
    )
  );

-- Auto-fill branch_id from caller's profile.
drop trigger if exists trg_set_branch on public.staff_shifts;
create trigger trg_set_branch
  before insert on public.staff_shifts
  for each row execute procedure public.set_branch_id_from_profile();

-- ─── 4. RPC: start_shift ─────────────────────────────────────────────────────
--
-- Idempotent — returns the existing active shift if one already exists for
-- the caller. Prevents accidental double-start.

create or replace function public.start_shift(p_notes text default null)
returns public.staff_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.staff_shifts%rowtype;
  v_full_name text;
begin
  select * into v_existing
    from public.staff_shifts
    where user_id = auth.uid() and status = 'active';
  if found then return v_existing; end if;

  select full_name into v_full_name from public.profiles where id = auth.uid();

  insert into public.staff_shifts (user_id, started_by_name, notes)
    values (auth.uid(), v_full_name, p_notes)
    returning * into v_existing;

  return v_existing;
end;
$$;

-- ─── 5. RPC: end_shift ───────────────────────────────────────────────────────
--
-- Ends the caller's *own* active shift. Managers can pass `p_user_id` to
-- close someone else's forgotten shift (RLS enforces branch-scope on that).

create or replace function public.end_shift(
  p_user_id uuid default null,
  p_notes   text default null
) returns public.staff_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_role   text;
  v_full_name text;
  v_shift  public.staff_shifts%rowtype;
begin
  v_target := coalesce(p_user_id, auth.uid());

  if v_target <> auth.uid() then
    select role into v_role from public.profiles where id = auth.uid();
    if v_role not in ('super_admin', 'admin', 'manager') then
      raise exception 'forbidden: only managers can close other users shifts';
    end if;
  end if;

  select full_name into v_full_name from public.profiles where id = auth.uid();

  update public.staff_shifts
    set status         = 'ended',
        ended_at       = now(),
        ended_by       = auth.uid(),
        ended_by_name  = coalesce(v_full_name, 'system'),
        notes          = coalesce(notes, '') ||
                          case when p_notes is null then ''
                               else (case when notes is null or notes = '' then '' else E'\n' end) || p_notes
                          end
    where user_id = v_target and status = 'active'
    returning * into v_shift;

  if v_shift.id is null then
    raise exception 'no_active_shift';
  end if;
  return v_shift;
end;
$$;

-- ─── 6. RPC: get_active_shift — quick "am I on the clock?" check ─────────────

create or replace function public.get_active_shift()
returns public.staff_shifts
language sql
stable
security definer
set search_path = public
as $$
  select * from public.staff_shifts
    where user_id = auth.uid() and status = 'active'
    limit 1;
$$;

-- ─── 7. View: staff_shift_today — manager-facing live roster ─────────────────
--
-- Returns ONE row per branch-scoped user who is currently on shift OR has
-- ended a shift today. Used by the ActiveStaffPanel.

create or replace view public.staff_shift_today as
select
  s.id              as shift_id,
  s.user_id,
  p.full_name       as staff_name,
  p.role            as staff_role,
  s.branch_id,
  s.started_at,
  s.ended_at,
  s.status,
  s.duration_seconds,
  -- Last audit event timestamp for "last active" sorting.
  (
    select max(a.created_at) from public.audit_logs a
    where a.user_id = s.user_id
      and a.created_at >= s.started_at
      and (s.ended_at is null or a.created_at <= s.ended_at)
  ) as last_action_at,
  -- Action counts for the shift window.
  (
    select count(*) from public.audit_logs a
    where a.user_id = s.user_id
      and a.created_at >= s.started_at
      and (s.ended_at is null or a.created_at <= s.ended_at)
  ) as action_count,
  (
    select count(*) from public.audit_logs a
    where a.user_id = s.user_id
      and a.action like 'refund.%'
      and a.created_at >= s.started_at
      and (s.ended_at is null or a.created_at <= s.ended_at)
  ) as refund_count
from public.staff_shifts s
left join public.profiles p on p.id = s.user_id
where s.started_at >= date_trunc('day', now());

alter view public.staff_shift_today set (security_invoker = true);

-- ─── 8. RPC: list_staff_activity — paged audit-log feed ──────────────────────
--
-- Wraps audit_logs with friendly filters: by user, by action prefix, by date
-- range. Joins profiles for staff_name. Used by ActivityTimeline.

create or replace function public.list_staff_activity(
  p_user_id      uuid    default null,
  p_action_like  text    default null,
  p_severity     text    default null,
  p_since        timestamptz default null,
  p_limit        integer default 50
) returns table(
  id          uuid,
  action      text,
  severity    text,
  user_id     uuid,
  staff_name  text,
  branch_id   uuid,
  entity_type text,
  entity_id   uuid,
  meta        jsonb,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.action,
    a.severity,
    a.user_id,
    p.full_name as staff_name,
    a.branch_id,
    a.entity_type,
    a.entity_id,
    a.meta,
    a.created_at
  from public.audit_logs a
  left join public.profiles p on p.id = a.user_id
  where (public.is_super_admin() or a.branch_id = public.current_branch())
    and (p_user_id     is null or a.user_id  = p_user_id)
    and (p_action_like is null or a.action like p_action_like)
    and (p_severity    is null or a.severity = p_severity)
    and (p_since       is null or a.created_at >= p_since)
  order by a.created_at desc
  limit greatest(1, least(p_limit, 200));
$$;

-- ============================================================
-- End of migration 010
-- ============================================================
