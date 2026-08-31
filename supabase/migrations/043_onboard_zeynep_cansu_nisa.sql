-- ─── 043 — Onboarding: Zeynep, Cansu, Nisa (personnel change, Ağustos 2026) ──
--
-- Creates three new PERSONEL (role = 'staff') accounts on the existing
-- account architecture — no second auth system, no new tables:
--
--   auth.users + auth.identities   → username@gokids.local, bcrypt password
--   public.profiles                → username, full_name, role, pin_hash
--   public.staff_quick_auth        → plaintext password mirror the lock-screen
--                                    PIN switch needs (see 041 / pin_switch)
--
-- ═══════════════════════════════════════════════════════════════════════════
--  ⚠️  OWNER ACTION REQUIRED — FILL IN THE CREDENTIALS BELOW BEFORE RUNNING
-- ═══════════════════════════════════════════════════════════════════════════
--
--  The app cannot create accounts from the UI (that needs the service_role
--  key), and this migration deliberately does NOT invent passwords or PINs —
--  Cumhur Yüksel / Owner assigns them. Replace every __SET_ME__ below.
--  The script refuses to run while any placeholder remains.
--
--  Rules the script enforces for you:
--    • PIN must be exactly 4 digits.
--    • PIN must not collide with any other ACTIVE employee's PIN — the lock
--      screen matches on the PIN alone, so a duplicate would sign the wrong
--      person in. (Archived employees' PINs are ignored; 041 excludes them.)
--    • Username must be unique (case-insensitive).
--
--  Idempotent: re-running re-syncs password / PIN to the values below.
--
--  This file stays a TEMPLATE on purpose — the real passwords are never
--  committed. Fill a throwaway copy outside the repo, run that, delete it.
--  (The repo already carries plaintext credentials for the older accounts in
--  scripts/seed-production-users.sql; that is a pattern to stop repeating,
--  not to extend.)
--
--  Convention this business uses for PERSONEL accounts: password = PIN, and
--  username = the person's first name in lower case (dila, sude, sevilay).
--  Owner/manager accounts use longer passwords.

create extension if not exists pgcrypto;

do $$
declare
  rec        record;
  v_email    text;
  v_uid      uuid;
  v_pw_hash  text;
  v_clash    text;
begin
  for rec in
    select * from (values
      -- username ,  full_name ,  login password ,  4-digit PIN
      ('zeynep',    'Zeynep',    '__SET_ME__',     '__SET_ME__'),
      ('cansu',     'Cansu',     '__SET_ME__',     '__SET_ME__'),
      ('nisa',      'Nisa',      '__SET_ME__',     '__SET_ME__')
    ) as t(username, full_name, password, pin)
  loop
    -- ── Guards ──────────────────────────────────────────────────────────────
    if rec.password = '__SET_ME__' or rec.pin = '__SET_ME__' then
      raise exception
        'Credentials for "%" are still placeholders. Fill in the password and 4-digit PIN at the top of migration 043 before running it.',
        rec.full_name;
    end if;

    if rec.pin !~ '^[0-9]{4}$' then
      raise exception 'PIN for "%" must be exactly 4 digits', rec.full_name;
    end if;

    -- 4 characters, because that is what this business already runs on: the
    -- existing personel accounts use password = PIN (Sevilay 4321, Sude 3435,
    -- Dila 6248). GoTrue only enforces a minimum on signup/update — we write
    -- the bcrypt hash straight into auth.users, and sign-in just compares it,
    -- which is why those accounts work today.
    --
    -- ⚠️  A 4-digit password is weak in the ordinary sense. It is acceptable
    --     here only because this is a shop-floor kiosk on one shared machine
    --     behind the venue's own network, and because the owner chose to keep
    --     the convention consistent across staff. Do NOT copy this for an
    --     admin/owner account — those use longer passwords (see 5-char
    --     cumhuryuksel / eylul).
    if length(rec.password) < 4 then
      raise exception 'Password for "%" is too short (min 4 characters)', rec.full_name;
    end if;

    -- PIN collision against every employee who is still able to sign in.
    select p.full_name into v_clash
      from public.profiles p
     where p.pin_hash is not null
       and coalesce(p.disabled,  false) = false
       and coalesce(p.is_active, true)  = true
       and p.left_at is null
       and lower(p.username) is distinct from rec.username
       and p.pin_hash = crypt(rec.pin, p.pin_hash)
     limit 1;

    if v_clash is not null then
      raise exception
        'PIN for "%" collides with active employee "%". The lock screen matches on the PIN alone — pick a different 4-digit PIN.',
        rec.full_name, v_clash;
    end if;

    -- Username taken by somebody else?
    if exists (
      select 1 from public.profiles
       where lower(username) = rec.username
         and full_name is distinct from rec.full_name
    ) then
      raise exception 'Username "%" already belongs to a different person', rec.username;
    end if;

    -- ── auth.users ──────────────────────────────────────────────────────────
    v_email   := rec.username || '@gokids.local';
    v_pw_hash := crypt(rec.password, gen_salt('bf'));

    select id into v_uid from auth.users where email = v_email;

    if v_uid is null then
      v_uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_email, v_pw_hash, now(), now(), now(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object('full_name', rec.full_name),
        false, '', '', '', ''
      );

      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_uid::text, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        'email', now(), now(), now()
      );
    else
      -- Existing account (re-run): re-sync the password and lift any ban.
      update auth.users
         set encrypted_password = v_pw_hash,
             banned_until       = null,
             updated_at         = now()
       where id = v_uid;
    end if;

    -- ── profiles ────────────────────────────────────────────────────────────
    --
    -- role = 'staff'  → the normal playground-employee role. Its defaults
    -- (src/lib/permissions.ts DEFAULT_MODULE_ACCESS.staff) grant Hızlı Kayıt,
    -- Aktif Oyun, Perakende and Gün Sonu only. permissions = '{}' means NO
    -- per-user override, so no finance / personnel / settings / branch access.
    insert into public.profiles (
      id, username, full_name, role, pin_hash,
      permissions, disabled, is_active, left_at, archived_reason
    ) values (
      v_uid, rec.username, rec.full_name, 'staff', crypt(rec.pin, gen_salt('bf')),
      '{}'::jsonb, false, true, null, null
    )
    on conflict (id) do update
      set username        = excluded.username,
          full_name       = excluded.full_name,
          role            = excluded.role,
          pin_hash        = excluded.pin_hash,
          disabled        = false,
          is_active       = true,
          left_at         = null,
          archived_reason = null;

    -- ── staff_quick_auth ────────────────────────────────────────────────────
    --
    -- MUST stay in sync with auth.users.encrypted_password — the lock-screen
    -- PIN switch signs in with this plaintext copy. Changing one without the
    -- other silently breaks quick-switch (or login).
    insert into public.staff_quick_auth (user_id, auth_email, auth_password)
      values (v_uid, v_email, rec.password)
      on conflict (user_id) do update
        set auth_email    = excluded.auth_email,
            auth_password = excluded.auth_password,
            updated_at    = now();

    -- ── trail ───────────────────────────────────────────────────────────────
    begin
      insert into public.audit_logs (action, severity, entity_type, entity_id, meta, actor_id)
        values ('staff.created', 'info', 'profile', v_uid,
                jsonb_build_object('full_name', rec.full_name,
                                   'username',  rec.username,
                                   'role',      'staff'),
                auth.uid());
    exception when undefined_table then null;
    end;

    raise notice 'PROVISIONED — % (% / %)', rec.full_name, rec.username, v_uid;
  end loop;
end$$;

notify pgrst, 'reload schema';

-- ── Verification ────────────────────────────────────────────────────────────
--
-- 1) The three exist, are active, are PERSONEL, and hold no overrides:
--
--   select username, full_name, role, is_active, disabled, left_at,
--          permissions, pin_hash is not null as has_pin
--     from public.profiles
--    where lower(username) in ('zeynep','cansu','nisa');
--
--   Expect role='staff', is_active=t, disabled=f, left_at=null,
--          permissions='{}', has_pin=t.
--
-- 2) Both credential stores agree (see the dual-store rule):
--
--   select p.username,
--          u.encrypted_password = crypt(sa.auth_password, u.encrypted_password) as pw_in_sync
--     from public.profiles p
--     join auth.users u            on u.id = p.id
--     join public.staff_quick_auth sa on sa.user_id = p.id
--    where lower(p.username) in ('zeynep','cansu','nisa');   -- expect all true
--
-- 3) No PIN is shared by two people who can sign in:
--
--   select count(*) from public.profiles a join public.profiles b
--     on a.id < b.id and a.pin_hash = crypt('<pin>', a.pin_hash)
--                    and b.pin_hash = crypt('<pin>', b.pin_hash)
--    where a.left_at is null and b.left_at is null;          -- expect 0
