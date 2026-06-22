-- ─── Restore get_expected_totals + get_day_end_summary ─────────────────────
-- These were accidentally dropped during reporting RPC cleanup.
-- /gun-sonu page calls get_expected_totals → "Kasa verisi yüklenemedi".

create or replace function public.get_expected_totals()
returns json language sql security definer set search_path=public as $$
  with d as (select public.tr_today() as t),
  pay as (
    select coalesce(sum(cash_amount),  0)::numeric as cash,
           coalesce(sum(card_amount),  0)::numeric as card,
           coalesce(sum(wallet_amount),0)::numeric as wallet
      from public.payments, d
     where (created_at at time zone 'Europe/Istanbul')::date = d.t
  ),
  ret as (
    select coalesce(sum(cash_amount), 0)::numeric as cash,
           coalesce(sum(card_amount), 0)::numeric as card
      from public.retail_sales, d
     where not voided
       and (sold_at at time zone 'Europe/Istanbul')::date = d.t
  )
  select json_build_object(
    'expectedCash',   (select cash from pay) + (select cash from ret),
    'expectedCard',   (select card from pay) + (select card from ret),
    'expectedWallet', (select wallet from pay),
    'expectedTotal',  (select cash from pay) + (select card from pay) + (select wallet from pay)
                      + (select cash from ret) + (select card from ret),
    'refundTotal', 0,
    'refundCount', 0
  );
$$;
grant execute on function public.get_expected_totals() to authenticated;

create or replace function public.get_day_end_summary(p_date date default null)
returns json language sql security definer set search_path=public as $$
  with d as (select coalesce(p_date, public.tr_today()) as target),
  pay as (
    select coalesce(sum(cash_amount),  0)::numeric as cash,
           coalesce(sum(card_amount),  0)::numeric as card,
           coalesce(sum(wallet_amount),0)::numeric as wallet,
           coalesce(sum(total_amount), 0)::numeric as total,
           count(*)::int as cnt
      from public.payments
     where (created_at at time zone 'Europe/Istanbul')::date = (select target from d)
  ),
  ret as (
    select coalesce(sum(cash_amount), 0)::numeric as cash,
           coalesce(sum(card_amount), 0)::numeric as card,
           coalesce(sum(total_amount),0)::numeric as total,
           count(*)::int as cnt
      from public.retail_sales
     where not voided
       and (sold_at at time zone 'Europe/Istanbul')::date = (select target from d)
  ),
  sess as (
    select count(*)::int as cnt from public.sessions
     where (created_at at time zone 'Europe/Istanbul')::date = (select target from d)
  )
  select json_build_object(
    'date',          (select target from d),
    'cash',          (select cash from pay) + (select cash from ret),
    'card',          (select card from pay) + (select card from ret),
    'wallet',        (select wallet from pay),
    'total',         (select total from pay) + (select total from ret),
    'session_count', (select cnt from sess),
    'payment_count', (select cnt from pay) + (select cnt from ret),
    'retail_count',  (select cnt from ret),
    'retail_total',  (select total from ret));
$$;
grant execute on function public.get_day_end_summary(date) to authenticated;

select 'day-end RPCs restored' as status,
       (public.get_expected_totals())::text as expected,
       (public.get_day_end_summary())::text as today;
