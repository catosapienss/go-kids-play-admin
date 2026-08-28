-- ─── 039 — Personal access entitlements (customer-specific punch passes) ─────
--
-- PRODUCTION-SAFE, ADDITIVE, NON-DESTRUCTIVE.
--
-- IMPORTANT: production's `memberships` table uses the migration-035 column
-- names — `membership_type`, `start_at`, `end_at` — NOT migration-014's
-- (`type`, `started_at`, `ends_at`). This migration + the personal-entitlement
-- code speak the LIVE schema.
--
-- Models a customer-specific playground-access entitlement (e.g. "Serhat Bey /
-- Elis — 20 entry days for ₺5.000, 120 dk/day") as a personal punch_pass bound
-- to one parent+child, flagged is_personal=true so it never appears in the
-- public catalog.
--
-- What it does:
--   1. Adds nullable/defaulted columns to `memberships` (is_personal, label,
--      payment_status, total_uses, daily_minutes). Existing rows untouched.
--   2. Adds two NEW additive RPCs: create_personal_entitlement (insert) and
--      consume_personal_entitlement (decrement one day, auto-expire at 0,
--      row-locked). No existing RPC or table is modified.
--
-- The unique-index adjustment that lets a parent hold two active personal
-- entitlements (20-day + 14-day) at once is applied separately at deploy time,
-- after inspecting the live index name — see deploy notes.

begin;

-- ── 1. memberships — personal-entitlement columns (additive, live schema) ────
alter table public.memberships
  add column if not exists is_personal    boolean not null default false,
  add column if not exists label          text,
  add column if not exists payment_status text,   -- 'paid' | 'unpaid' | 'partial'
  add column if not exists total_uses     integer,
  add column if not exists daily_minutes  integer; -- minutes/day; null/0 = unlimited
-- payment_method already exists in the live schema.

-- ── 2. create_personal_entitlement — NEW additive RPC (live columns) ────────
create or replace function public.create_personal_entitlement(
  p_parent_id      uuid,
  p_child_id       uuid,
  p_label          text,
  p_price          numeric,
  p_uses           integer,
  p_payment_method text default 'cash',
  p_payment_status text default 'paid',
  p_notes          text default null,
  p_daily_minutes  integer default null
) returns public.memberships
language plpgsql security definer set search_path = public
as $FN$
declare
  v_row public.memberships%rowtype;
begin
  if coalesce(p_uses, 0) <= 0 then
    raise exception 'personal_entitlement_requires_uses';
  end if;
  if p_parent_id is null or p_child_id is null then
    raise exception 'personal_entitlement_requires_parent_and_child';
  end if;

  insert into public.memberships (
    parent_id, child_id, membership_type, status,
    start_at, total_uses, remaining_uses,
    price, is_personal, label, payment_status, payment_method, daily_minutes,
    notes
  ) values (
    p_parent_id, p_child_id, 'punch_pass', 'active',
    now(), p_uses, p_uses,
    p_price, true, p_label, p_payment_status, p_payment_method, p_daily_minutes,
    p_notes
  )
  returning * into v_row;

  return v_row;
end;
$FN$;

grant execute on function public.create_personal_entitlement(uuid, uuid, text, numeric, integer, text, text, text, integer) to authenticated;

-- ── 3. consume_personal_entitlement — NEW additive RPC (live columns) ───────
-- Decrements one remaining day; auto-expires at 0; row-locked for concurrency.
-- Self-contained (does not depend on the legacy consume_membership_use).
create or replace function public.consume_personal_entitlement(
  p_membership_id uuid
) returns public.memberships
language plpgsql security definer set search_path = public
as $FN$
declare
  v_row public.memberships%rowtype;
begin
  select * into v_row from public.memberships where id = p_membership_id for update;
  if v_row.id is null then raise exception 'entitlement_not_found'; end if;
  if v_row.is_personal is not true then raise exception 'not_personal_entitlement'; end if;
  if v_row.status <> 'active' then raise exception 'entitlement_not_active'; end if;
  if coalesce(v_row.remaining_uses, 0) <= 0 then raise exception 'no_uses_left'; end if;

  update public.memberships
     set remaining_uses = remaining_uses - 1,
         status = case when remaining_uses - 1 <= 0 then 'expired' else 'active' end,
         updated_at = now()
   where id = p_membership_id
   returning * into v_row;

  return v_row;
end;
$FN$;

grant execute on function public.consume_personal_entitlement(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
