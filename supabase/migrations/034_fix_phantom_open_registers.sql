-- ─── 033 — Fix phantom open registers + duplicate day-end closings ───────────
--
-- Second half of the End-of-Day owner-visibility bug (first half = migration 031
-- which made the closing HISTORY readable by every authorized user, not just the
-- super_admin owner).
--
-- Symptom: after ANY user closes the day, re-opening /gun-sonu calls
-- open_cash_register() which — finding no *open* register (it's now closed) —
-- lazily created a SECOND 'open' row for the same business_date. getTodayRegister
-- then returned that newer open row, so the owner's day-end card showed a day
-- that was already closed as "not closed" → "I can't see the closing" → and let
-- the owner close again → duplicate closed rows per day. Prod had a leftover
-- 'open' row alongside the 'closed' row on almost every business_date.
--
-- Fix:
--   1. open_cash_register() now REUSES today's register, preferring the CLOSED
--      one. So once a day is closed, no phantom 'open' is created, and a second
--      close attempt updates a row that is not 'open' → returns 0 → the RPC
--      raises 'register_already_closed' (duplicate protection). Branch match is
--      NULL-tolerant for the single-shop deployment.
--   2. Clean up existing PHANTOM 'open' rows — an 'open' register that coexists
--      with a 'closed' one for the same branch+day is a leftover, never a real
--      closing. CLOSED rows (the actual closings) are never touched.
--
-- Additive + production-safe. No closing record is deleted or overwritten.

create or replace function public.open_cash_register()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch uuid;
  v_id     uuid;
begin
  v_branch := public.current_branch();

  -- Reuse today's register for this branch, preferring the CLOSED one so a
  -- closed day stays closed (no phantom re-open, no duplicate close).
  select id into v_id
    from public.cash_register_closings
    where business_date = current_date
      and (branch_id is not distinct from v_branch
           or v_branch is null
           or branch_id is null)
    order by (status = 'closed') desc, opened_at desc
    limit 1;

  if v_id is not null then return v_id; end if;

  insert into public.cash_register_closings (branch_id, business_date, status)
    values (v_branch, current_date, 'open')
    returning id into v_id;
  return v_id;
end;
$$;

-- Remove leftover phantom 'open' rows for days that are already closed.
delete from public.cash_register_closings o
where o.status = 'open'
  and exists (
    select 1 from public.cash_register_closings c
    where c.status = 'closed'
      and c.business_date = o.business_date
      and c.branch_id is not distinct from o.branch_id
  );
