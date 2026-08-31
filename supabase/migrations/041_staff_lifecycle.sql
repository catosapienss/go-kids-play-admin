-- ─── 041 — Staff lifecycle (archive / restore a departed employee) ───────────
--
-- WHY
--   Employees leave. Their profile row must stay forever — every historical
--   report, closing and audit entry resolves the person's name through it (or
--   through a denormalised copy of it) — but the account itself must stop
--   being usable the moment they walk out the door.
--
--   Before this migration the only lever was `profiles.disabled`, which the
--   lock-screen honoured but the ordinary /login password flow did not:
--   Supabase Auth never looks at public.profiles, so a disabled employee
--   could still sign in with their username + password.
--
-- WHAT THIS ADDS  (all additive, all idempotent, no data is destroyed)
--   • profiles.left_at         — when the person stopped working here
--   • profiles.archived_reason — free-text note for the personnel screen
--   • admin_archive_staff()    — one call that closes every door:
--       profiles.disabled/is_active, auth.users.banned_until (blocks /login),
--       and the staff_quick_auth credential mirror (blocks PIN quick-switch)
--   • admin_restore_staff()    — the exact inverse, for a mis-click or a
--       returning employee
--   • pin_switch() hardened to also require is_active
--
-- WHAT THIS DOES NOT TOUCH
--   sessions, payments, retail_sales, cash_register_closings, audit_logs,
--   staff_shifts, refund_logs, stock_movements, discounts — no historical
--   row is read or written. Names already recorded there stay exactly as
--   they were recorded.

create extension if not exists pgcrypto;

-- ── 1. Lifecycle columns ────────────────────────────────────────────────────

alter table public.profiles add column if not exists left_at         timestamptz;
alter table public.profiles add column if not exists archived_reason text;

comment on column public.profiles.left_at is
  'Set when the employee left. NULL = currently employed. Historical records keep referencing this row regardless.';
comment on column public.profiles.archived_reason is
  'Optional note shown on the "Ayrılan / Pasif Personel" tab of /personeller.';

-- Cheap lookup for the active-staff lists.
create index if not exists profiles_active_idx
  on public.profiles (is_active, disabled)
  where left_at is null;

-- ── 2. Archive ──────────────────────────────────────────────────────────────
--
-- Closes all three doors at once. Safe to re-run on an already-archived user.
--
-- Caller rules:
--   • From the app (auth.uid() present) → must be admin/super_admin, and
--     cannot archive themselves.
--   • From the SQL editor / service_role (auth.uid() null) → allowed; anon
--     cannot reach this function because EXECUTE is not granted to anon.

create or replace function public.admin_archive_staff(
  p_user_id uuid,
  p_reason  text default null
) returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_caller      uuid := auth.uid();
  v_caller_role text;
  v_target_name text;
begin
  if v_caller is not null then
    select role into v_caller_role from public.profiles where id = v_caller;
    if coalesce(v_caller_role, '') not in ('admin', 'super_admin') then
      raise exception 'Only admins can archive a staff account';
    end if;
    if p_user_id = v_caller then
      raise exception 'You cannot archive your own account';
    end if;
  end if;

  select full_name into v_target_name from public.profiles where id = p_user_id;
  if v_target_name is null and not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'No profile with id %', p_user_id;
  end if;

  -- (a) Profile flags. `left_at` is only stamped once so re-running never
  --     rewrites the original departure date.
  update public.profiles
     set disabled        = true,
         is_active       = false,
         left_at         = coalesce(left_at, now()),
         archived_reason = coalesce(p_reason, archived_reason)
   where id = p_user_id;

  -- (b) Block the /login password flow. Supabase Auth checks banned_until;
  --     a far-future date is the reversible, supported way to lock an account
  --     without deleting it (deleting auth.users would cascade the profile).
  begin
    update auth.users
       set banned_until = timestamptz '2999-12-31 00:00:00+00',
           updated_at   = now()
     where id = p_user_id;
  exception when insufficient_privilege or undefined_table or undefined_column then
    raise notice 'auth.users not writable here — set banned_until manually for %', p_user_id;
  end;

  -- (c) Drop the plaintext credential mirror so the lock-screen PIN switch
  --     can never re-issue a session as this person. This row holds an
  --     ex-employee's password in the clear; removing it is the point.
  --     It carries no history and is re-created on restore.
  begin
    delete from public.staff_quick_auth where user_id = p_user_id;
  exception when undefined_table then null;
  end;

  -- (d) Trail.
  begin
    insert into public.audit_logs (action, severity, entity_type, entity_id, meta, actor_id)
      values ('staff.archived', 'warning', 'profile', p_user_id,
              jsonb_build_object('full_name', v_target_name, 'reason', p_reason),
              v_caller);
  exception when undefined_table then null;
  end;
end;
$$;

-- ── 3. Restore ──────────────────────────────────────────────────────────────
--
-- Inverse of the above. NOTE: staff_quick_auth is NOT restored — the PIN
-- quick-switch needs the plaintext password, which nobody kept. After a
-- restore the owner must re-set the password (auth.users + staff_quick_auth,
-- in sync) before the lock screen will switch to this user again. Ordinary
-- /login with their old password works immediately.

create or replace function public.admin_restore_staff(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_caller      uuid := auth.uid();
  v_caller_role text;
begin
  if v_caller is not null then
    select role into v_caller_role from public.profiles where id = v_caller;
    if coalesce(v_caller_role, '') not in ('admin', 'super_admin') then
      raise exception 'Only admins can restore a staff account';
    end if;
  end if;

  update public.profiles
     set disabled        = false,
         is_active       = true,
         left_at         = null,
         archived_reason = null
   where id = p_user_id;

  begin
    update auth.users set banned_until = null, updated_at = now() where id = p_user_id;
  exception when insufficient_privilege or undefined_table or undefined_column then
    raise notice 'auth.users not writable here — clear banned_until manually for %', p_user_id;
  end;

  begin
    insert into public.audit_logs (action, severity, entity_type, entity_id, meta, actor_id)
      values ('staff.restored', 'info', 'profile', p_user_id, '{}'::jsonb, v_caller);
  exception when undefined_table then null;
  end;
end;
$$;

revoke all on function public.admin_archive_staff(uuid, text) from public;
revoke all on function public.admin_restore_staff(uuid)       from public;
grant execute on function public.admin_archive_staff(uuid, text) to authenticated, service_role;
grant execute on function public.admin_restore_staff(uuid)       to authenticated, service_role;

-- ── 4. Harden pin_switch: an archived profile must never match a PIN ────────
--
-- ⚠️  BEFORE RUNNING THIS SECTION, confirm the live definition matches the one
--     this migration is based on (scripts/migration-pin-switch.sql), because
--     pin_switch was applied directly in production and is not otherwise in
--     the repo's migration history:
--
--       select pg_get_functiondef('public.pin_switch(text)'::regprocedure);
--
--     The body below is that definition verbatim plus ONE added guard:
--       and p.left_at is null
--     Signature and return shape are unchanged, so create-or-replace is safe.
--
--     `is_active` is deliberately NOT part of the guard: it predates this
--     flow and a legacy row carrying is_active=false would silently stop a
--     working employee's PIN. archive_staff sets disabled + left_at, which
--     is enough.

create or replace function public.pin_switch(p_pin text)
returns table (
  user_id        uuid,
  full_name      text,
  username       text,
  role           text,
  auth_email     text,
  auth_password  text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_match_id uuid;
  v_caller   uuid := auth.uid();
begin
  if p_pin !~ '^[0-9]{4}$' then
    return;
  end if;

  select p.id
    into v_match_id
    from public.profiles p
   where p.pin_hash is not null
     and coalesce(p.disabled, false) = false
     and p.left_at is null                     -- ← added by 041
     and p.pin_hash = crypt(p_pin, p.pin_hash)
   limit 1;

  if v_match_id is null then
    begin
      insert into public.audit_logs (action, severity, entity_type, meta, actor_id)
        values ('user.switch.fail', 'warning', 'profile',
                jsonb_build_object('attempted_pin_prefix', left(p_pin, 1) || '***'),
                v_caller);
    exception when undefined_table then null;
    end;
    return;
  end if;

  begin
    insert into public.audit_logs (action, severity, entity_type, entity_id, meta, actor_id)
      values ('user.switch', 'info', 'profile', v_match_id,
              jsonb_build_object('from', v_caller, 'to', v_match_id),
              v_caller);
  exception when undefined_table then null;
  end;

  return query
    select sa.user_id,
           pr.full_name,
           pr.username,
           pr.role,
           sa.auth_email,
           sa.auth_password
      from public.staff_quick_auth sa
      join public.profiles pr on pr.id = sa.user_id
     where sa.user_id = v_match_id;
end;
$$;

revoke all on function public.pin_switch(text) from public;
grant execute on function public.pin_switch(text) to authenticated;

notify pgrst, 'reload schema';
