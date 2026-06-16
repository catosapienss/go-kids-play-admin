-- ─── 015 — User Management (username, PIN, granular permissions) ────────────
--
-- Brings the profiles table up to the production-ready shape:
--   • username            → unique short handle used at login (replaces email-as-id)
--   • pin_hash            → bcrypt-hashed 4-digit lock-screen PIN
--   • permissions         → per-user JSONB overrides on top of role defaults
--   • last_login_at       → for the staff management screen + audit
--   • disabled            → admin-disabled accounts cannot sign in
--
-- All changes are additive + idempotent. Existing rows keep working.

create extension if not exists pgcrypto;

-- ── profiles extensions ─────────────────────────────────────────────────────
alter table public.profiles add column if not exists username    text;
alter table public.profiles add column if not exists pin_hash    text;
alter table public.profiles add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.profiles add column if not exists disabled    boolean not null default false;

-- Unique on username (case-insensitive). Partial so legacy rows without a
-- username don't violate the constraint during migration.
create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

-- ── PIN RPCs ────────────────────────────────────────────────────────────────
--
-- verify_pin(pin)     → checks the supplied 4-digit PIN for the caller.
-- set_pin(new_pin)    → caller updates their own PIN.
-- admin_set_pin(uid, new_pin) → admin can reset another user's PIN.

create or replace function public.verify_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select pin_hash into v_hash from public.profiles where id = auth.uid();
  if v_hash is null then return false; end if;
  return v_hash = crypt(p_pin, v_hash);
end;
$$;

create or replace function public.set_pin(p_new_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  update public.profiles
     set pin_hash = crypt(p_new_pin, gen_salt('bf'))
   where id = auth.uid();
end;
$$;

create or replace function public.admin_set_pin(p_user_id uuid, p_new_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_role text;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role not in ('admin', 'super_admin') then
    raise exception 'Only admins can reset another user''s PIN';
  end if;
  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  update public.profiles
     set pin_hash = crypt(p_new_pin, gen_salt('bf'))
   where id = p_user_id;
end;
$$;

grant execute on function public.verify_pin(text)       to authenticated;
grant execute on function public.set_pin(text)          to authenticated;
grant execute on function public.admin_set_pin(uuid, text) to authenticated;

-- ── last_login tracker ──────────────────────────────────────────────────────
create or replace function public.touch_last_login()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_login_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_login() to authenticated;

-- ── Birthday packages (Phase 4 — schema created early so migrations stay linear)
create table if not exists public.birthday_packages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  price       numeric(10,2) not null default 0,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.birthday_packages enable row level security;

drop policy if exists "birthday_packages read" on public.birthday_packages;
create policy "birthday_packages read"
  on public.birthday_packages for select
  to authenticated
  using (true);

drop policy if exists "birthday_packages admin write" on public.birthday_packages;
create policy "birthday_packages admin write"
  on public.birthday_packages for all
  to authenticated
  using (
    exists (select 1 from public.profiles
             where id = auth.uid() and role in ('admin', 'super_admin'))
  )
  with check (
    exists (select 1 from public.profiles
             where id = auth.uid() and role in ('admin', 'super_admin'))
  );
