-- ─── Tables ────────────────────────────────────────────────────────────────

create table if not exists wallet_transactions (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid not null references parents(id) on delete cascade,
  type          text not null check (type in ('load', 'use', 'refund', 'bonus')),
  amount        numeric(10,2) not null,
  description   text not null default '',
  method        text,                          -- load method: cash|card (null for use/refund/bonus)
  session_id    uuid references sessions(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists session_extensions (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references sessions(id) on delete cascade,
  added_minutes   integer not null,
  payment_amount  numeric(10,2) not null default 0,
  payment_type    text not null check (payment_type in ('cash', 'card', 'wallet', 'free')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists refund_logs (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions(id) on delete cascade,
  parent_id      uuid references parents(id) on delete set null,
  refund_amount  numeric(10,2) not null default 0,
  refund_reason  text not null,
  staff_note     text,
  refunded_by    uuid references auth.users(id) on delete set null,
  refund_method  text not null default 'wallet',
  created_at     timestamptz not null default now()
);

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table wallet_transactions enable row level security;
alter table session_extensions enable row level security;
alter table refund_logs enable row level security;

create policy "authenticated full access" on wallet_transactions
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on session_extensions
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on refund_logs
  for all to authenticated using (true) with check (true);

-- ─── wallet_balance column on parents ──────────────────────────────────────

alter table parents add column if not exists wallet_balance numeric(10,2) not null default 0;

-- ─── Realtime ───────────────────────────────────────────────────────────────

alter publication supabase_realtime add table wallet_transactions;

-- ─── RPC: load_wallet_balance ───────────────────────────────────────────────

create or replace function load_wallet_balance(
  p_parent_id   uuid,
  p_amount      numeric,
  p_bonus       numeric,
  p_description text,
  p_method      text,
  p_created_by  uuid
) returns void
language plpgsql
security definer
as $$
begin
  -- Update parent balance
  update parents
  set wallet_balance = wallet_balance + p_amount + p_bonus
  where id = p_parent_id;

  -- Record load transaction
  insert into wallet_transactions (parent_id, type, amount, description, method, created_by)
  values (p_parent_id, 'load', p_amount, p_description, p_method, p_created_by);

  -- Record bonus transaction if applicable
  if p_bonus > 0 then
    insert into wallet_transactions (parent_id, type, amount, description, created_by)
    values (p_parent_id, 'bonus', p_bonus, 'Yükleme bonusu', p_created_by);
  end if;
end;
$$;

-- ─── RPC: extend_session_with_payment ──────────────────────────────────────

create or replace function extend_session_with_payment(
  p_session_id     uuid,
  p_minutes        integer,
  p_payment_amount numeric,
  p_payment_type   text,
  p_created_by     uuid
) returns void
language plpgsql
security definer
as $$
declare
  v_session  sessions%rowtype;
  v_parent_id uuid;
begin
  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found';
  end if;

  -- Extend end_time (or set it if session was free-play)
  if v_session.end_time is not null then
    update sessions
    set end_time = end_time + (p_minutes * interval '1 minute'),
        duration_minutes = duration_minutes + p_minutes
    where id = p_session_id;
  else
    -- Paused: extend paused_remaining_seconds
    update sessions
    set paused_remaining_seconds = coalesce(paused_remaining_seconds, 0) + (p_minutes * 60),
        duration_minutes = duration_minutes + p_minutes
    where id = p_session_id;
  end if;

  -- Record extension
  insert into session_extensions (session_id, added_minutes, payment_amount, payment_type, created_by)
  values (p_session_id, p_minutes, p_payment_amount, p_payment_type, p_created_by);

  -- Handle payment
  if p_payment_type = 'wallet' and p_payment_amount > 0 then
    v_parent_id := v_session.parent_id;
    if v_parent_id is null then
      raise exception 'No parent linked to session';
    end if;
    -- Check balance
    if (select wallet_balance from parents where id = v_parent_id) < p_payment_amount then
      raise exception 'Insufficient wallet balance';
    end if;
    update parents set wallet_balance = wallet_balance - p_payment_amount where id = v_parent_id;
    insert into wallet_transactions (parent_id, type, amount, description, session_id, created_by)
    values (v_parent_id, 'use', p_payment_amount, 'Süre uzatma ödemesi', p_session_id, p_created_by);
  end if;
end;
$$;

-- ─── RPC: cancel_and_refund ────────────────────────────────────────────────

create or replace function cancel_and_refund(
  p_session_id  uuid,
  p_reason      text,
  p_note        text,
  p_refunded_by uuid
) returns numeric
language plpgsql
security definer
as $$
declare
  v_session       sessions%rowtype;
  v_elapsed_mins  numeric;
  v_refund_amount numeric := 0;
  v_parent_id     uuid;
begin
  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found';
  end if;

  -- Enforce 10-minute cancellation window
  v_elapsed_mins := extract(epoch from (now() - v_session.start_time)) / 60;
  if v_elapsed_mins > 10 then
    raise exception 'Cancellation window expired (%.1f minutes elapsed)', v_elapsed_mins;
  end if;

  -- Double refund protection
  if exists (select 1 from refund_logs where session_id = p_session_id) then
    raise exception 'Refund already processed for this session';
  end if;

  v_parent_id := v_session.parent_id;

  -- Calculate refund from session extensions (wallet payments only)
  select coalesce(sum(se.payment_amount), 0) into v_refund_amount
  from session_extensions se
  where se.session_id = p_session_id
    and se.payment_type = 'wallet';

  -- End the session
  update sessions set status = 'completed', end_time = now() where id = p_session_id;

  -- Refund wallet if amount > 0 and parent exists
  if v_refund_amount > 0 and v_parent_id is not null then
    update parents set wallet_balance = wallet_balance + v_refund_amount where id = v_parent_id;
    insert into wallet_transactions (parent_id, type, amount, description, session_id, created_by)
    values (v_parent_id, 'refund', v_refund_amount, 'Oturum iptali iadesi', p_session_id, p_refunded_by);
  end if;

  -- Log the refund
  insert into refund_logs (session_id, parent_id, refund_amount, refund_reason, staff_note, refunded_by, refund_method)
  values (p_session_id, v_parent_id, v_refund_amount, p_reason, p_note, p_refunded_by, 'wallet');

  return v_refund_amount;
end;
$$;
