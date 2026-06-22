-- ─── Restore cash-register RPCs (table-returning, snake_case columns) ──────
--
-- Earlier "DROP FUNCTION ... cascade" cascaded into close_cash_register
-- (it referenced get_expected_totals). My JSON-returning rewrite also
-- used camelCase keys whereas the frontend reads snake_case. This patch:
-- 1. Replaces get_expected_totals as a TABLE-returning version so
--    `select * into v_expected from get_expected_totals()` works and
--    the frontend's `row.expected_cash` reads succeed.
-- 2. Re-installs close_cash_register matching the original 009 contract.
-- 3. Reloads PostgREST schema cache.

drop function if exists public.get_expected_totals() cascade;

create or replace function public.get_expected_totals()
returns table (
  expected_cash     numeric,
  expected_card     numeric,
  expected_wallet   numeric,
  expected_total    numeric,
  refund_total      numeric,
  session_count     int,
  transaction_count int
) language sql security definer set search_path=public as $$
  with d as (select public.tr_today() as t),
  pay as (
    select coalesce(sum(cash_amount),  0)::numeric as cash,
           coalesce(sum(card_amount),  0)::numeric as card,
           coalesce(sum(wallet_amount),0)::numeric as wallet,
           count(*)::int as cnt
      from public.payments, d
     where (created_at at time zone 'Europe/Istanbul')::date = d.t
  ),
  ret as (
    select coalesce(sum(cash_amount), 0)::numeric as cash,
           coalesce(sum(card_amount), 0)::numeric as card,
           count(*)::int as cnt
      from public.retail_sales, d
     where not voided
       and (sold_at at time zone 'Europe/Istanbul')::date = d.t
  ),
  sess as (
    select count(*)::int as cnt
      from public.sessions, d
     where (created_at at time zone 'Europe/Istanbul')::date = d.t
  )
  select
    ((select cash from pay) + (select cash from ret))::numeric as expected_cash,
    ((select card from pay) + (select card from ret))::numeric as expected_card,
    (select wallet from pay)::numeric                          as expected_wallet,
    ((select cash from pay) + (select card from pay) + (select wallet from pay)
     + (select cash from ret) + (select card from ret))::numeric as expected_total,
    0::numeric                                                  as refund_total,
    (select cnt from sess)                                      as session_count,
    ((select cnt from pay) + (select cnt from ret))             as transaction_count;
$$;
grant execute on function public.get_expected_totals() to authenticated;

create or replace function public.close_cash_register(
  p_counted_cash    numeric,
  p_counted_card    numeric,
  p_counted_wallet  numeric,
  p_notes           text,
  p_meta            jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_register_id uuid;
  v_role        text;
  v_full_name   text;
  v_expected    record;
  v_register    public.cash_register_closings%rowtype;
begin
  select role, full_name into v_role, v_full_name
    from public.profiles where id = auth.uid();

  if v_role not in ('super_admin', 'admin', 'manager') then
    raise exception 'forbidden: cash close requires admin or manager role';
  end if;

  v_register_id := public.open_cash_register();

  select * into v_expected from public.get_expected_totals() limit 1;

  if (p_counted_cash   <> v_expected.expected_cash
   or p_counted_card   <> v_expected.expected_card
   or p_counted_wallet <> v_expected.expected_wallet)
   and coalesce(length(btrim(p_notes)), 0) = 0
  then
    raise exception 'discrepancy_requires_notes';
  end if;

  update public.cash_register_closings
     set status            = 'closed',
         closed_at         = now(),
         closed_by         = auth.uid(),
         closed_by_name    = coalesce(v_full_name, 'system'),
         expected_cash     = v_expected.expected_cash,
         expected_card     = v_expected.expected_card,
         expected_wallet   = v_expected.expected_wallet,
         expected_total    = v_expected.expected_total,
         counted_cash      = p_counted_cash,
         counted_card      = p_counted_card,
         counted_wallet    = p_counted_wallet,
         refund_total      = v_expected.refund_total,
         session_count     = v_expected.session_count,
         transaction_count = v_expected.transaction_count,
         notes             = coalesce(p_notes, ''),
         meta              = p_meta
   where id = v_register_id and status = 'open'
   returning * into v_register;

  if v_register.id is null then
    raise exception 'register_already_closed';
  end if;

  return to_jsonb(v_register);
end;
$$;
grant execute on function public.close_cash_register(numeric, numeric, numeric, text, jsonb) to authenticated;

notify pgrst, 'reload schema';

select 'cash-register RPCs restored' as status,
       (select expected_total from public.get_expected_totals()) as expected_total_now;
