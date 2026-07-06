-- ─── 023 — FIX: convert_to_unlimited RPC missing in production ──────────────
--
-- ROOT CAUSE of "Sınırsız uzatma başarısız":
--   Migration 004 (which defines convert_to_unlimited) was never applied to the
--   production database. The 30 / 60 minute path uses extend_session_with_payment
--   (which DOES exist) and works; the Unlimited path calls convert_to_unlimited,
--   which PostgREST rejects as a missing function → the client shows the error.
--   Introspection confirmed: the function was absent and 0 unlimited extensions
--   had ever been recorded (session_extensions.added_minutes = 9999 → 0 rows).
--
-- FIX: (re)create the function, idempotently, with an explicit search_path and
-- an execute grant. No client change is needed — the app already calls it
-- correctly (same shape as the working extension RPC).
--
-- Unlimited is stored as duration_minutes = 0 + end_time = null (the app's
-- existing "Serbest" sentinel), so Active Game, dashboards, reports and
-- realtime all treat it as ∞ with no further mapping changes.

create or replace function public.convert_to_unlimited(
  p_session_id     uuid,
  p_payment_amount numeric,
  p_payment_type   text,
  p_created_by     uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session sessions%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found';
  end if;

  -- Convert to unlimited / Serbest: clear the timer, zero the duration.
  update public.sessions
     set end_time = null,
         duration_minutes = 0,
         paused_remaining_seconds = null
   where id = p_session_id;

  -- Audit the extension (added_minutes = 9999 is the unlimited marker).
  insert into public.session_extensions
    (session_id, added_minutes, payment_amount, payment_type, created_by)
  values
    (p_session_id, 9999, p_payment_amount, p_payment_type, p_created_by);

  -- Wallet tender is settled here (cash/card are mirrored into `payments`
  -- by the client so they land in revenue/day-end exactly like a normal sale).
  if p_payment_type = 'wallet' and p_payment_amount > 0 then
    if v_session.parent_id is null then
      raise exception 'No parent linked to session';
    end if;
    if (select wallet_balance from public.parents where id = v_session.parent_id) < p_payment_amount then
      raise exception 'Insufficient wallet balance';
    end if;
    update public.parents
       set wallet_balance = wallet_balance - p_payment_amount
     where id = v_session.parent_id;
    insert into public.wallet_transactions
      (parent_id, type, amount, description, session_id, created_by)
    values
      (v_session.parent_id, 'use', p_payment_amount, 'Sınırsız pakete geçiş', p_session_id, p_created_by);
  end if;
end;
$$;

grant execute on function public.convert_to_unlimited(uuid, numeric, text, uuid) to authenticated;
