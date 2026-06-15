-- ============================================================
-- GoKids Play — Auth Foundation Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Profiles table (extends auth.users with role data)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  role       text not null default 'cashier'
               check (role in ('admin', 'manager', 'cashier')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read all profiles (for Personeller module)
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 2. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Seed demo users (run after creating users via Supabase Auth)
-- Step 1: Create the users in Supabase Auth → Authentication → Users:
--   admin@gokids.com      / demo1234
--   yonetici@gokids.com   / demo1234
--   kasiyer@gokids.com    / demo1234
--
-- Step 2: Then run these updates using the UUIDs from the auth.users table:
--
-- update public.profiles set full_name = 'Ahmet Kaya',   role = 'admin'   where id = '<admin-uuid>';
-- update public.profiles set full_name = 'Selin Yıldız', role = 'manager' where id = '<manager-uuid>';
-- update public.profiles set full_name = 'Emre Taşkın',  role = 'cashier' where id = '<cashier-uuid>';
