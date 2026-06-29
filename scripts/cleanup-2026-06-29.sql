-- ─── Cleanup: only rows created on 2026-06-29 (Europe/Istanbul) ─────────────
--
-- Removes today's test/preview rows from the transactional tables. Anything
-- created before 2026-06-29 (TR local time) is LEFT UNTOUCHED.
--
-- Scope (all filtered by "created day = 2026-06-29 Europe/Istanbul"):
--   • public.payments
--   • public.session_extensions
--   • public.refund_logs
--   • public.wallet_transactions
--   • public.discounts
--   • public.organization_payments
--   • public.retail_sales      (lines cascade via FK)
--   • public.sessions          (start_time)
--   • public.audit_logs
--   • public.cash_register_closings
--
-- DOES NOT TOUCH:
--   • public.parents / children / organizations (master data)
--   • public.profiles / auth.users
--   • Anything dated before 2026-06-29
--
-- The whole thing runs as one transaction — if any step errors out, nothing
-- is committed. Run it once in Supabase Dashboard → SQL Editor.

begin;

with target_day as (select date '2026-06-29' as d)

-- ── 1. payments (created today TR) ─────────────────────────────────────────
, del_payments as (
  delete from public.payments
   where (created_at at time zone 'Europe/Istanbul')::date
         = (select d from target_day)
   returning 1
)

-- ── 2. session_extensions ──────────────────────────────────────────────────
, del_ext as (
  delete from public.session_extensions
   where (created_at at time zone 'Europe/Istanbul')::date
         = (select d from target_day)
   returning 1
)

-- ── 3. refund_logs ─────────────────────────────────────────────────────────
, del_refunds as (
  delete from public.refund_logs
   where (created_at at time zone 'Europe/Istanbul')::date
         = (select d from target_day)
   returning 1
)

-- ── 4. wallet_transactions ─────────────────────────────────────────────────
, del_wallet as (
  delete from public.wallet_transactions
   where (created_at at time zone 'Europe/Istanbul')::date
         = (select d from target_day)
   returning 1
)

-- ── 5. discounts ───────────────────────────────────────────────────────────
, del_discounts as (
  delete from public.discounts
   where (created_at at time zone 'Europe/Istanbul')::date
         = (select d from target_day)
   returning 1
)

-- ── 6. organization_payments ───────────────────────────────────────────────
, del_org_pay as (
  delete from public.organization_payments
   where (created_at at time zone 'Europe/Istanbul')::date
         = (select d from target_day)
   returning 1
)

-- ── 7. retail_sales (lines cascade through FK) ─────────────────────────────
, del_retail as (
  delete from public.retail_sales
   where (sold_at at time zone 'Europe/Istanbul')::date
         = (select d from target_day)
   returning 1
)

-- ── 8. sessions (start_time) ───────────────────────────────────────────────
, del_sessions as (
  delete from public.sessions
   where (start_time at time zone 'Europe/Istanbul')::date
         = (select d from target_day)
   returning 1
)

-- ── 9. audit_logs ──────────────────────────────────────────────────────────
, del_audit as (
  delete from public.audit_logs
   where (created_at at time zone 'Europe/Istanbul')::date
         = (select d from target_day)
   returning 1
)

-- ── 10. cash_register_closings (today's open/close events) ─────────────────
, del_cash as (
  delete from public.cash_register_closings
   where (created_at at time zone 'Europe/Istanbul')::date
         = (select d from target_day)
   returning 1
)

select
  (select count(*) from del_payments)  as payments_deleted,
  (select count(*) from del_ext)       as extensions_deleted,
  (select count(*) from del_refunds)   as refunds_deleted,
  (select count(*) from del_wallet)    as wallet_tx_deleted,
  (select count(*) from del_discounts) as discounts_deleted,
  (select count(*) from del_org_pay)   as org_payments_deleted,
  (select count(*) from del_retail)    as retail_sales_deleted,
  (select count(*) from del_sessions)  as sessions_deleted,
  (select count(*) from del_audit)     as audit_rows_deleted,
  (select count(*) from del_cash)      as cash_register_closings_deleted;

commit;

-- ── 11. Local label-queue reset ────────────────────────────────────────────
-- The daily queue number lives in browser localStorage (gkp_label_queue) and
-- resets automatically when the date rolls. If you want to force it back to
-- "001" immediately on the cashier device, in the browser console run:
--   localStorage.removeItem('gkp_label_queue')
--   localStorage.removeItem('gkp_label_session_queue')
