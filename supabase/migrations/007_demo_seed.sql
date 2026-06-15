-- ============================================================
-- GoKids Play — Demo Environment Foundation
-- Migration 007
--
-- Adds:
--   1. `is_demo` column on key operational tables — lets us tag rows that the
--      demo populator created without touching real data.
--   2. `purge_demo_data()` RPC — one-click cleanup that drops only demo rows.
--   3. Optional seed branch + super-admin marker for showroom deployments.
--
-- Safe to run multiple times.
-- ============================================================

-- ─── 1. is_demo flags ─────────────────────────────────────────────────────────
--
-- We *don't* drop the rows generated before this migration — the populator
-- can be retrofitted to start marking new inserts via the column default.

do $$ declare t text;
begin
  foreach t in array array[
    'parents', 'children', 'sessions', 'payments',
    'wallet_transactions', 'session_extensions', 'refund_logs',
    'organizations'
  ] loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = t) then
      execute format(
        'alter table public.%I add column if not exists is_demo boolean not null default false',
        t
      );
      execute format(
        'create index if not exists idx_%I_is_demo on public.%I (is_demo) where is_demo = true',
        t, t
      );
    end if;
  end loop;
end $$;

-- ─── 2. purge_demo_data() ─────────────────────────────────────────────────────
--
-- Removes only rows marked `is_demo = true`. Safe to call anytime; never
-- touches real operational data. Order matters because of FK chains.

create or replace function public.purge_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parents   integer := 0;
  v_children  integer := 0;
  v_sessions  integer := 0;
  v_payments  integer := 0;
  v_wallet    integer := 0;
  v_refunds   integer := 0;
  v_orgs      integer := 0;
begin
  -- Caller must be admin or super_admin.
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin')
  ) then
    raise exception 'forbidden: only admins may purge demo data';
  end if;

  -- Drop in reverse-FK order. Tables that may not exist are guarded.
  delete from public.refund_logs        where is_demo = true returning 1 into v_refunds;
  delete from public.session_extensions where is_demo = true;
  delete from public.payments           where is_demo = true returning 1 into v_payments;
  delete from public.wallet_transactions where is_demo = true returning 1 into v_wallet;
  delete from public.sessions           where is_demo = true returning 1 into v_sessions;
  delete from public.children           where is_demo = true returning 1 into v_children;
  delete from public.parents            where is_demo = true returning 1 into v_parents;

  -- organizations table may not exist yet — best effort.
  begin
    delete from public.organizations    where is_demo = true returning 1 into v_orgs;
  exception when undefined_table then
    v_orgs := 0;
  end;

  return jsonb_build_object(
    'parents',   v_parents,
    'children',  v_children,
    'sessions',  v_sessions,
    'payments',  v_payments,
    'wallet_transactions', v_wallet,
    'refund_logs', v_refunds,
    'organizations', v_orgs
  );
end;
$$;

-- ─── 3. Helper: mark_all_today_as_demo() (escape hatch) ──────────────────────
--
-- Use this if you accidentally populated against a real DB and need to flag
-- today's rows as demo so `purge_demo_data()` can clean them up. Admin only.

create or replace function public.mark_all_today_as_demo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin')
  ) then
    raise exception 'forbidden';
  end if;

  update public.parents             set is_demo = true where created_at >= date_trunc('day', now());
  update public.children            set is_demo = true where created_at >= date_trunc('day', now());
  update public.sessions            set is_demo = true where created_at >= date_trunc('day', now());
  update public.payments            set is_demo = true where created_at >= date_trunc('day', now());
  update public.wallet_transactions set is_demo = true where created_at >= date_trunc('day', now());
  update public.session_extensions  set is_demo = true where created_at >= date_trunc('day', now());
  update public.refund_logs         set is_demo = true where created_at >= date_trunc('day', now());

  begin
    update public.organizations     set is_demo = true where created_at >= date_trunc('day', now());
  exception when undefined_table or undefined_column then null;
  end;
end;
$$;

-- ============================================================
-- End of migration 007
-- ============================================================
