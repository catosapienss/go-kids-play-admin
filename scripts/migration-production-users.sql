-- ─── Production user provisioning ────────────────────────────────────────────
--
-- One-time SQL to be run in Supabase Dashboard → SQL Editor while logged in
-- as a service_role / dashboard user (auth.uid() not required).
--
-- WHAT IT DOES
--   1. Removes the demo accounts seeded during development
--      (admin@example.com, manager@example.com, demo*@*).
--   2. Creates 5 production users via auth.users + a matching public.profiles
--      row. Passwords are stored as bcrypt hashes in auth.users.encrypted_password.
--   3. Sets each user's 4-digit lock-screen PIN with the same bcrypt scheme
--      the verify_pin() RPC checks against.
--
-- WHAT IT DOES NOT TOUCH
--   public.sessions, public.payments, public.parents, public.children,
--   public.organizations, public.retail_sales — none of those are read or
--   written by this script.
--
-- Idempotent: the script upserts on `username`, so re-running it just
-- re-syncs role + password + PIN to the latest values below.
--
-- ⚠️  After running, REVOKE the credentials shared in chat from any local
-- copies of this file. Rotate them later via /personeller if needed.

create extension if not exists pgcrypto;

-- ── 1. Wipe demo accounts ──────────────────────────────────────────────────
-- Delete profiles first so the FK reference clears, then auth.users.
delete from public.profiles
  where username in ('admin', 'manager', 'demo', 'demo_staff', 'demo_admin')
     or full_name ilike 'demo%'
     or full_name in ('Admin Demo', 'Manager Demo', 'Staff Demo');

delete from auth.users
  where email in ('admin@example.com', 'manager@example.com',
                  'admin@gokids.local', 'manager@gokids.local',
                  'demo@gokids.local', 'demo_staff@gokids.local')
     or email like 'demo%@%';

-- ── 2. Helper to create-or-update a production user ────────────────────────
create or replace function public._provision_user(
  p_username   text,
  p_password   text,
  p_pin        text,
  p_full_name  text,
  p_role       text
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(p_username) || '@gokids.local';
  v_uid   uuid;
  v_hash  text;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be 4 digits, got %', p_pin;
  end if;

  v_hash := crypt(p_password, gen_salt('bf'));

  -- Find existing auth user by email.
  select id into v_uid from auth.users where email = v_email;

  if v_uid is null then
    -- Create the auth row. instance_id is the default Supabase project instance.
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
      recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, v_hash, now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('full_name', p_full_name),
      false, '', '', '', ''
    );
    -- Mirror identity row so Supabase Auth lookups succeed.
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    -- Re-sync password on every run so this script can rotate credentials.
    update auth.users
       set encrypted_password = v_hash,
           updated_at         = now()
     where id = v_uid;
  end if;

  -- Upsert the profile row.
  insert into public.profiles (id, username, full_name, role, pin_hash, disabled, is_active)
  values (v_uid, lower(p_username), p_full_name, p_role,
          crypt(p_pin, gen_salt('bf')), false, true)
  on conflict (id) do update
    set username  = excluded.username,
        full_name = excluded.full_name,
        role      = excluded.role,
        pin_hash  = excluded.pin_hash,
        disabled  = false,
        is_active = true;

  return v_uid;
end;
$$;

-- ── 3. Provision the real users ────────────────────────────────────────────
select public._provision_user('cumhuryuksel', '23865',  '2386', 'Cumhur Yüksel',     'super_admin');
select public._provision_user('eylul85643',   '85643',  '8564', 'Eylül',             'manager');
select public._provision_user('sevilay4321',  '4321',   '4321', 'Sevilay',           'staff');
select public._provision_user('sude3435',     '3435',   '3435', 'Sude',              'staff');
select public._provision_user('dila6248',     '6248',   '6248', 'Dila',              'staff');

-- Clean up the helper function — it should not stay callable as authenticated.
drop function public._provision_user(text, text, text, text, text);

-- ── 4. Reload PostgREST schema so any new profile columns are visible ──────
notify pgrst, 'reload schema';

-- ── 5. Verification queries (run these to confirm) ────────────────────────
-- select username, full_name, role, disabled
--   from public.profiles
--   order by case role
--              when 'super_admin' then 1
--              when 'admin'       then 2
--              when 'manager'     then 3
--              else 4 end, username;
--
-- select email from auth.users order by email;
