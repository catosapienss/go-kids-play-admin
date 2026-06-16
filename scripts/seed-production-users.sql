-- ─── Production User Seed ───────────────────────────────────────────────────
--
-- Idempotent. Safe to re-run. Creates the 5 production accounts the operator
-- specified, using the "synthetic email" convention:
--
--   username @ gokids.local
--
-- so Supabase Auth (which requires email) can still store the account while
-- the user only ever sees the username at the login screen.
--
-- PINs are bcrypt-hashed via crypt(). Passwords are bcrypt-hashed the same way.
--
-- ┌──────────────┬───────────┬──────────┬───────┐
-- │ Username     │ Role      │ Password │ PIN   │
-- ├──────────────┼───────────┼──────────┼───────┤
-- │ cumhuryuksel │ admin     │ 23865    │ 8423  │
-- │ eylul        │ manager   │ 85643    │ 6271  │
-- │ sevilay      │ staff     │ k7m2x9   │ 1847  │
-- │ sude         │ staff     │ p3q8z5   │ 2953  │
-- │ dila         │ staff     │ r6w4n1   │ 6294  │
-- └──────────────┴───────────┴──────────┴───────┘
--
-- Run this AFTER 015_user_management.sql is applied.

create extension if not exists pgcrypto;

-- ── helper: upsert a user into auth.users + profiles ────────────────────────
do $$
declare
  rec record;
  v_uid uuid;
begin
  for rec in
    select * from (values
      ('cumhuryuksel', 'admin'::text,   '23865', '8423', 'Cumhur Yüksel'),
      ('eylul',        'manager'::text, '85643', '6271', 'Eylül'),
      ('sevilay',      'staff'::text,   'k7m2x9','1847', 'Sevilay'),
      ('sude',         'staff'::text,   'p3q8z5','2953', 'Sude'),
      ('dila',         'staff'::text,   'r6w4n1','6294', 'Dila')
    ) as t(username, role, password, pin, full_name)
  loop
    -- 1. Upsert auth.users
    select id into v_uid from auth.users where email = rec.username || '@gokids.local';

    if v_uid is null then
      v_uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role,
        email, encrypted_password, email_confirmed_at,
        created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_uid,
        'authenticated',
        'authenticated',
        rec.username || '@gokids.local',
        crypt(rec.password, gen_salt('bf')),
        now(),
        now(),
        now(),
        jsonb_build_object('provider', 'username', 'providers', array['username']),
        jsonb_build_object('username', rec.username, 'full_name', rec.full_name),
        false, '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', rec.username || '@gokids.local'),
        'email',
        v_uid::text,
        now(), now(), now()
      );
    else
      -- Refresh password every run so the operator can re-seed if they forget.
      update auth.users
         set encrypted_password = crypt(rec.password, gen_salt('bf')),
             updated_at = now()
       where id = v_uid;
    end if;

    -- 2. Upsert profiles row
    insert into public.profiles (id, full_name, role, username, pin_hash, is_active, permissions)
    values (
      v_uid,
      rec.full_name,
      rec.role,
      rec.username,
      crypt(rec.pin, gen_salt('bf')),
      true,
      '{}'::jsonb
    )
    on conflict (id) do update
      set full_name = excluded.full_name,
          role      = excluded.role,
          username  = excluded.username,
          pin_hash  = excluded.pin_hash,
          is_active = true,
          disabled  = false;
  end loop;
end$$;

-- ── verification ────────────────────────────────────────────────────────────
select username, role, is_active, pin_hash is not null as has_pin
  from public.profiles
 where username in ('cumhuryuksel','eylul','sevilay','sude','dila')
 order by case role when 'admin' then 1 when 'manager' then 2 else 3 end, username;
