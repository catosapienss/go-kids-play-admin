-- ─── RPC: convert_to_unlimited ──────────────────────────────────────────────
-- Converts a timed session to unlimited (Serbest) play.
-- Clears end_time and duration_minutes, records a payment.

create or replace function convert_to_unlimited(
  p_session_id     uuid,
  p_payment_amount numeric,
  p_payment_type   text,
  p_created_by     uuid
) returns void
language plpgsql
security definer
as $$
declare
  v_session  sessions%rowtype;
begin
  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found';
  end if;

  -- Clear end_time and reset duration to 0 (= unlimited / Serbest)
  update sessions
  set end_time = null,
      duration_minutes = 0,
      paused_remaining_seconds = null
  where id = p_session_id;

  -- Record in session_extensions (added_minutes = 9999 = unlimited marker)
  insert into session_extensions (session_id, added_minutes, payment_amount, payment_type, created_by)
  values (p_session_id, 9999, p_payment_amount, p_payment_type, p_created_by);

  -- Handle wallet deduction
  if p_payment_type = 'wallet' and p_payment_amount > 0 then
    if v_session.parent_id is null then
      raise exception 'No parent linked to session';
    end if;
    if (select wallet_balance from parents where id = v_session.parent_id) < p_payment_amount then
      raise exception 'Insufficient wallet balance';
    end if;
    update parents
    set wallet_balance = wallet_balance - p_payment_amount
    where id = v_session.parent_id;

    insert into wallet_transactions (parent_id, type, amount, description, session_id, created_by)
    values (v_session.parent_id, 'use', p_payment_amount, 'Sınırsız pakete geçiş', p_session_id, p_created_by);
  end if;
end;
$$;
