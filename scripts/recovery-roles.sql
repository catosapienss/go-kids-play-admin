-- ─────────────────────────────────────────────────────────────────────────────
-- GO KIDS PLAY — ROLE & SCHEMA RECOVERY SCRIPT
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Run this in your Supabase project's SQL Editor (one shot, top-to-bottom).
-- It is IDEMPOTENT — safe to run multiple times.
--
-- What it does:
--   1. Drops the strict role CHECK constraint and replaces it with a wider
--      one that accepts the five roles the app now supports.
--   2. Adds `branch_id` column to `public.profiles` (nullable).
--   3. Adds `notes` column (optional, used by some settings flows).
--   4. Provides templated UPDATEs to assign the right role to your users.
--
-- After running:
--   • Restart your Next.js dev server (or hard-refresh the browser)
--   • Sign in — the correct sidebar should appear immediately
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Expand role CHECK to include the new roles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('super_admin', 'admin', 'manager', 'staff', 'cashier'));

-- 2. Add branch_id (nullable so existing rows stay valid)
alter table public.profiles
  add column if not exists branch_id uuid;

-- 3. Add notes column (used by a couple of admin flows)
alter table public.profiles
  add column if not exists notes text;

-- 4. ASSIGN ROLES — uncomment and edit for your accounts
--
-- Promote the demo admin (already correct, here for reference):
--   update public.profiles set role = 'admin'   where id = (select id from auth.users where email = 'admin@gokids.com');
--
-- Make a manager (REPLACE email with the real address):
--   update public.profiles set role = 'manager' where id = (select id from auth.users where email = 'manager@gokids.com');
--
-- Make staff:
--   update public.profiles set role = 'staff'   where id = (select id from auth.users where email = 'personel@gokids.com');
--
-- Bulk-promote: every user currently set to 'cashier' or NULL to 'manager':
--   update public.profiles set role = 'manager' where role in ('cashier') or role is null;

-- 5. Verify — this should now return every user with their correct role
select
  p.id,
  u.email,
  p.full_name,
  p.role,
  p.is_active,
  p.branch_id
from public.profiles p
left join auth.users u on u.id = p.id
order by u.email;

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE. Hard-refresh the browser and sign in.
-- ─────────────────────────────────────────────────────────────────────────────
