-- ─── Multi-user PIN unlock + user switching ────────────────────────────────
--
-- The lock-screen currently calls verify_pin() which only succeeds for the
-- CURRENT user's PIN. The shop runs on one shared computer — any active
-- employee must be able to type their PIN and have the session switch to
-- them. We do that with a small credentials-mirror table + a security-definer
-- RPC. The frontend signs out the previous user and signs in as the new one
-- using the credentials the RPC returns.
--
-- Threat model: the credentials table is locked behind RLS (no direct select
-- from any role). The RPC only returns the row when the supplied 4-digit PIN
-- matches the bcrypt hash on the matching profile. With 10 000 possible PINs
-- and a 30-second client-side cooldown after 3 fails, brute force is
-- impractical for the shop-floor environment.
--
-- Idempotent: re-running the script overwrites the credentials with the
-- latest values below. After running, REVOKE the credentials from any
-- temporary copy of this file you keep on disk.

create extension if not exists pgcrypto;

-- ── 1. Credentials mirror ──────────────────────────────────────────────────
create table if not exists public.staff_quick_auth (
  user_id       uuid        primary key references public.profiles(id) on delete cascade,
  auth_email    text        not null,
  auth_password text        not null,
  updated_at    timestamptz not null default now()
);

alter table public.staff_quick_auth enable row level security;

-- No SELECT / INSERT / UPDATE / DELETE policies for any role. Only the
-- security-definer RPC below can read this table.
revoke all on public.staff_quick_auth from anon, authenticated;

-- ── 2. PIN → credentials RPC ───────────────────────────────────────────────
--
-- Returns the matching user's credentials only when the PIN matches an
-- active, non-disabled profile. Always also writes an audit_logs row so
-- failed attempts and successful switches are both traceable.

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

  -- Find the active profile whose bcrypt'd PIN matches.
  select p.id
    into v_match_id
    from public.profiles p
   where p.pin_hash is not null
     and coalesce(p.disabled, false) = false
     and p.pin_hash = crypt(p_pin, p.pin_hash)
   limit 1;

  if v_match_id is null then
    -- Log the failed attempt (caller's uid if they had one).
    begin
      insert into public.audit_logs (action, severity, entity_type, meta, actor_id)
        values ('user.switch.fail', 'warning', 'profile',
                jsonb_build_object('attempted_pin_prefix', left(p_pin, 1) || '***'),
                v_caller);
    exception when undefined_table then null;
    end;
    return;
  end if;

  -- Log the switch BEFORE returning credentials.
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

-- ── 3. Populate credentials for the 5 production users ─────────────────────
--
-- Helper bypasses RLS via security-definer. Inserts or updates the email +
-- password pair for the matching username. Plaintext password lives in the
-- table because Supabase Auth needs it raw to sign the user in.
create or replace function public._set_quick_auth(p_username text, p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid;
begin
  select id into v_uid from public.profiles where username = lower(p_username);
  if v_uid is null then
    raise notice 'profile % not found, skipping', p_username;
    return;
  end if;
  insert into public.staff_quick_auth (user_id, auth_email, auth_password)
    values (v_uid, lower(p_username) || '@gokids.local', p_password)
    on conflict (user_id) do update
      set auth_email    = excluded.auth_email,
          auth_password = excluded.auth_password,
          updated_at    = now();
end;
$$;

select public._set_quick_auth('cumhuryuksel', '23865');
select public._set_quick_auth('eylul85643',   '85643');
select public._set_quick_auth('sevilay4321',  '4321');
select public._set_quick_auth('sude3435',     '3435');
select public._set_quick_auth('dila6248',     '6248');

drop function public._set_quick_auth(text, text);

notify pgrst, 'reload schema';

-- Sanity check (optional — uncomment after running):
-- select user_id, auth_email from public.staff_quick_auth order by auth_email;
