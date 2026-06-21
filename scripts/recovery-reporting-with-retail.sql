-- ─── Update reporting RPCs to include retail_sales ──────────────────────────
--
-- Earlier recovery added timezone-aware RPCs that read only public.payments.
-- Retail sales were silently absent from /raporlar, /gun-sonu, and the
-- "today" KPI bar — the only screen that reflected them was the Owner
-- Dashboard panel (which uses daily_revenue_breakdown directly).
--
-- This patch re-defines the three core today-RPCs to sum payments AND
-- retail_sales, still TR-timezone aware via public.tr_today().

create or replace function public.get_revenue_periods()
returns json language sql security definer set search_path=public as $$
  with daily as (
    select (created_at at time zone 'Europe/Istanbul')::date as d,
           sum(total_amount)::numeric as v
      from public.payments group by 1
    union all
    select (sold_at at time zone 'Europe/Istanbul')::date,
           sum(total_amount)::numeric
      from public.retail_sales where not voided group by 1
  ),
  agg as (select d, sum(v) as v from daily group by d)
  select json_build_object(
    'today',     coalesce((select v from agg where d = public.tr_today()),0),
    'yesterday', coalesce((select v from agg where d = public.tr_today()-1),0),
    'week',      coalesce((select sum(v) from agg where d >= public.tr_today()-6),0),
    'prevWeek',  coalesce((select sum(v) from agg where d between public.tr_today()-13 and public.tr_today()-7),0),
    'month',     coalesce((select sum(v) from agg where d >= public.tr_today()-29),0),
    'prevMonth', coalesce((select sum(v) from agg where d between public.tr_today()-59 and public.tr_today()-30),0),
    'year',      coalesce((select sum(v) from agg where d >= public.tr_today()-364),0));
$$;
grant execute on function public.get_revenue_periods() to authenticated;

create or replace function public.get_day_end_summary(p_date date default null)
returns json language sql security definer set search_path=public as $$
  with d as (select coalesce(p_date, public.tr_today()) as target),
  pay as (
    select coalesce(sum(cash_amount),0) as cash,
           coalesce(sum(card_amount),0) as card,
           coalesce(sum(wallet_amount),0) as wallet,
           coalesce(sum(total_amount),0) as total,
           count(*) as cnt
      from public.payments
     where (created_at at time zone 'Europe/Istanbul')::date = (select target from d)
  ),
  ret as (
    select coalesce(sum(cash_amount),0) as cash,
           coalesce(sum(card_amount),0) as card,
           coalesce(sum(total_amount),0) as total,
           count(*) as cnt
      from public.retail_sales
     where not voided
       and (sold_at at time zone 'Europe/Istanbul')::date = (select target from d)
  ),
  sess as (
    select count(*) as cnt from public.sessions
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

create or replace function public.get_expected_totals()
returns json language plpgsql security definer set search_path=public as $$
declare v_cash numeric:=0; v_card numeric:=0; v_wallet numeric:=0;
        v_refund numeric:=0; v_refund_count int:=0;
        v_today date := public.tr_today();
        v_ret_cash numeric:=0; v_ret_card numeric:=0;
begin
  select coalesce(sum(cash_amount),0), coalesce(sum(card_amount),0),
         coalesce(sum(wallet_amount),0)
    into v_cash, v_card, v_wallet
    from public.payments
   where (created_at at time zone 'Europe/Istanbul')::date = v_today;

  select coalesce(sum(cash_amount),0), coalesce(sum(card_amount),0)
    into v_ret_cash, v_ret_card
    from public.retail_sales
   where not voided
     and (sold_at at time zone 'Europe/Istanbul')::date = v_today;

  begin
    select coalesce(sum(refund_amount),0), count(*) into v_refund, v_refund_count
      from public.refund_logs
     where (created_at at time zone 'Europe/Istanbul')::date = v_today;
  exception when undefined_table or undefined_column then v_refund:=0; v_refund_count:=0;
  end;

  return json_build_object(
    'expectedCash',  v_cash + v_ret_cash,
    'expectedCard',  v_card + v_ret_card,
    'expectedWallet',v_wallet,
    'expectedTotal', v_cash + v_card + v_wallet + v_ret_cash + v_ret_card,
    'refundTotal',v_refund,'refundCount',v_refund_count);
end;$$;
grant execute on function public.get_expected_totals() to authenticated;

select 'reporting RPCs include retail now' as status,
       (public.get_revenue_periods())::text as periods,
       (public.get_day_end_summary())::text as today;
