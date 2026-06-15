-- ============================================================
-- GoKids Play — Multi-Branch / Franchise Architecture Foundation
-- Migration 005
--
-- Goals:
--   1. Introduce a `branches` table (every business location).
--   2. Add `branch_id` to every operational table.
--   3. Extend `profiles` with `branch_id` + super_admin role.
--   4. Set up RLS so non–super-admin users see only their own branch.
--   5. Realtime continues working — channels now carry branch_id payload.
--
-- Safe to run multiple times: uses IF NOT EXISTS / DO blocks everywhere.
-- ============================================================

-- ─── 1. Branches table ────────────────────────────────────────────────────────

create table if not exists public.branches (
  id            uuid primary key default gen_random_uuid(),
  branch_name   text not null,
  branch_code   text not null unique,
  address       text,
  phone         text,
  status        text not null default 'active'
                  check (status in ('active', 'paused', 'archived')),
  /** Future tenant grouping: multiple branches under one franchise/tenant. */
  tenant_id     uuid,
  /** Subdomain for tenant routing: e.g. "kadikoy" → kadikoy.gokidsplay.com */
  subdomain     text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.branches enable row level security;

-- Everyone authenticated may LIST branches (so dropdowns work).
-- Writes are admin-only.
drop policy if exists "auth read branches" on public.branches;
create policy "auth read branches" on public.branches
  for select to authenticated using (true);

drop policy if exists "admin write branches" on public.branches;
create policy "admin write branches" on public.branches
  for all to authenticated using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  ) with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

-- Seed a default branch so existing rows have something to FK to.
insert into public.branches (id, branch_name, branch_code, status)
values ('00000000-0000-0000-0000-000000000001', 'Merkez Şube', 'MAIN', 'active')
on conflict (id) do nothing;

-- ─── 2. Profile extensions ────────────────────────────────────────────────────

-- a. Allow a new "super_admin" role.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('super_admin', 'admin', 'manager', 'cashier'));

-- b. Bind each profile to a branch (nullable for super_admin).
alter table public.profiles
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

-- Backfill existing profiles to the seed branch (unless they are super admins).
update public.profiles
  set branch_id = '00000000-0000-0000-0000-000000000001'
  where branch_id is null and role <> 'super_admin';

-- ─── 3. Helper: current_branch() ──────────────────────────────────────────────
--
-- Used by RLS policies. Returns the requesting user's branch_id, or NULL if
-- they are super_admin (the policies treat NULL as "see all").

create or replace function public.current_branch()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  )
$$;

-- ─── 4. Add branch_id to operational tables (idempotent) ──────────────────────
--
-- Note: `do $$ ... $$` blocks guard against missing tables — a fresh DB that
-- hasn't run earlier migrations won't fail; columns are added only where the
-- target table exists.

do $$ declare t text;
begin
  foreach t in array array[
    'parents', 'children', 'sessions', 'payments',
    'wallet_transactions', 'session_extensions', 'refund_logs',
    'organizations', 'birthdays', 'staff_logs'
  ] loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = t) then
      execute format(
        'alter table public.%I add column if not exists branch_id uuid references public.branches(id) on delete set null',
        t
      );
      -- Backfill rows whose branch is null with the seed branch.
      execute format(
        'update public.%I set branch_id = %L where branch_id is null',
        t,
        '00000000-0000-0000-0000-000000000001'
      );
      -- Index for fast scoped queries.
      execute format(
        'create index if not exists idx_%I_branch_id on public.%I (branch_id)',
        t, t
      );
    end if;
  end loop;
end $$;

-- ─── 5. Branch-scoped RLS policies ────────────────────────────────────────────
--
-- Pattern: a row is visible if it belongs to the caller's branch, OR the
-- caller is a super_admin. Writes follow the same predicate.
--
-- We DROP-and-CREATE policies so the migration is re-runnable. The previous
-- "authenticated full access" policies (added in migration 003) are replaced.

do $$ declare t text;
begin
  foreach t in array array[
    'parents', 'children', 'sessions', 'payments',
    'wallet_transactions', 'session_extensions', 'refund_logs',
    'organizations', 'birthdays', 'staff_logs'
  ] loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = t) then
      -- Drop legacy permissive policy if present.
      execute format(
        'drop policy if exists "authenticated full access" on public.%I',
        t
      );

      -- Drop and recreate branch-scoped policy.
      execute format('drop policy if exists "branch scoped read" on public.%I', t);
      execute format(
        $f$
        create policy "branch scoped read" on public.%I
          for select to authenticated
          using (
            public.is_super_admin()
            or branch_id = public.current_branch()
          )
        $f$,
        t
      );

      execute format('drop policy if exists "branch scoped write" on public.%I', t);
      execute format(
        $f$
        create policy "branch scoped write" on public.%I
          for all to authenticated
          using (
            public.is_super_admin()
            or branch_id = public.current_branch()
          )
          with check (
            public.is_super_admin()
            or branch_id = public.current_branch()
          )
        $f$,
        t
      );
    end if;
  end loop;
end $$;

-- ─── 6. Trigger: auto-fill branch_id from caller's profile on INSERT ──────────
--
-- Keeps app code simple — services don't have to remember to attach branch_id
-- to every insert. Super-admin inserts must set it explicitly (otherwise NULL).

create or replace function public.set_branch_id_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null then
    new.branch_id := (select branch_id from public.profiles where id = auth.uid());
  end if;
  return new;
end;
$$;

do $$ declare t text;
begin
  foreach t in array array[
    'parents', 'children', 'sessions', 'payments',
    'wallet_transactions', 'session_extensions', 'refund_logs',
    'organizations', 'birthdays', 'staff_logs'
  ] loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = t) then
      execute format('drop trigger if exists trg_set_branch on public.%I', t);
      execute format(
        'create trigger trg_set_branch
           before insert on public.%I
           for each row execute procedure public.set_branch_id_from_profile()',
        t
      );
    end if;
  end loop;
end $$;

-- ─── 7. Realtime: include branch_id in change payloads ───────────────────────
--
-- Supabase Realtime already emits the full row on `postgres_changes`, so the
-- client receives branch_id automatically. The client-side channel layer
-- filters by branch_id (see src/lib/branch/realtime-channel.ts).

-- ─── 8. Convenience view: branch_stats ───────────────────────────────────────

create or replace view public.branch_stats as
select
  b.id,
  b.branch_name,
  b.branch_code,
  b.status,
  coalesce(p.parent_count, 0) as parent_count,
  coalesce(s.session_count_today, 0) as session_count_today,
  coalesce(r.revenue_today, 0) as revenue_today
from public.branches b
left join (
  select branch_id, count(*) as parent_count
  from public.parents group by branch_id
) p on p.branch_id = b.id
left join (
  select branch_id, count(*) as session_count_today
  from public.sessions
  where created_at >= date_trunc('day', now())
  group by branch_id
) s on s.branch_id = b.id
left join (
  select branch_id, sum(total_amount) as revenue_today
  from public.payments
  where created_at >= date_trunc('day', now())
  group by branch_id
) r on r.branch_id = b.id;

-- View RLS: same scoping as base tables.
alter view public.branch_stats set (security_invoker = true);

-- ============================================================
-- End of migration 005
-- ============================================================
