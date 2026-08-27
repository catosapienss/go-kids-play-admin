-- ─── 039 — Personal access entitlements (customer-specific punch passes) ─────
--
-- PRODUCTION-SAFE, ADDITIVE, NON-DESTRUCTIVE.
--
-- Models a customer-specific playground-access entitlement (e.g. "Serhat Bey /
-- Elis — 20 entry days for ₺5.000") on the EXISTING `memberships` table as a
-- punch_pass, rather than a public catalog package. Reuses the proven
-- `consume_membership_use` RPC (decrements remaining_uses, auto-expires at 0,
-- row-locked for concurrency).
--
-- Why not the catalog: `membership_packages` is the public, selectable catalog.
-- A personal entitlement is a `memberships` row bound to ONE parent+child and
-- flagged `is_personal = true`, so it is never offered to other customers.
--
-- What this migration does:
--   1. Adds nullable/defaulted columns to `memberships` (is_personal, label,
--      payment_status, payment_method). Existing rows are untouched.
--   2. Relaxes the "one active punch_pass per parent" unique index to EXEMPT
--      personal entitlements, so the same parent can hold e.g. a 20-day AND a
--      14-day personal entitlement active at once (staff picks which to use).
--      Regular memberships keep the original one-active-per-type rule.
--   3. Adds `create_personal_entitlement(...)` — a NEW, additive RPC. No
--      existing RPC is modified.
--
-- What it deliberately does NOT do:
--   • It does not modify any existing membership, session, payment or report.
--   • It does not add anything to the public package catalog.
--   • It does not touch `consume_membership_use` (reused as-is).

begin;

-- ── 1. memberships — personal-entitlement columns (additive) ────────────────
alter table public.memberships
  add column if not exists is_personal    boolean not null default false,
  add column if not exists label          text,
  add column if not exists payment_status text,   -- 'paid' | 'unpaid' | 'partial'
  add column if not exists payment_method text;    -- 'cash' | 'card' | 'transfer'

-- ── 2. Relax the one-active-punch_pass rule for personal entitlements ────────
-- The original index (014) blocks two active rows of the same (parent, type).
-- Personal entitlements must be allowed to coexist (20-day + 14-day active
-- together), so exempt them. Regular memberships are unaffected.
drop index if exists public.uq_one_active_membership_per_parent_type;
create unique index if not exists uq_one_active_membership_per_parent_type
  on public.memberships (parent_id, type)
  where status in ('active', 'paused') and is_personal = false;

-- ── 3. create_personal_entitlement — NEW additive RPC ───────────────────────
-- Inserts a personal punch_pass bound to parent+child. Records the one-time
-- entitlement price + payment status on the membership row itself so it is
-- preserved separately from the ₺0 per-visit sessions it later authorises.
create or replace function public.create_personal_entitlement(
  p_parent_id      uuid,
  p_child_id       uuid,
  p_label          text,
  p_price          numeric,
  p_uses           integer,
  p_payment_method text default 'cash',
  p_payment_status text default 'paid',
  p_notes          text default null
) returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
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
    parent_id, child_id, type, status,
    started_at, total_uses, remaining_uses,
    price, is_personal, label, payment_status, payment_method,
    provider, notes
  ) values (
    p_parent_id, p_child_id, 'punch_pass', 'active',
    now(), p_uses, p_uses,
    p_price, true, p_label, p_payment_status, p_payment_method,
    'manual', p_notes
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_personal_entitlement(uuid, uuid, text, numeric, integer, text, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';
