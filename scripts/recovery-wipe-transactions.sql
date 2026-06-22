-- ─── ⚠️  PRODUCTION-PREP — wipe all transactional/test data ─────────────────
--
-- KEEPS:  profiles (personel), parents (müşteriler), birthday_packages,
--         branches, settings tables.
-- WIPES:  payments, retail_sales, sessions and their children, all
--         cash register history, all birthday reservations + their payments,
--         wallet transactions, refund logs, audit log, idempotency keys.
--
-- Designed to be re-runnable. Uses TRUNCATE ... RESTART IDENTITY CASCADE so
-- FK chains are followed and sequences reset. Tables that don't exist are
-- skipped silently.

do $$
declare
  tbl text;
  candidates text[] := array[
    'organization_payments',
    'organizations',
    'payments',
    'retail_sales',
    'retail_sale_items',
    'session_extensions',
    'session_alerts',
    'sessions',
    'cash_register_closings',
    'wallet_transactions',
    'refund_logs',
    'idempotency_keys',
    'audit_log',
    'entry_codes',
    'staff_shifts'
  ];
begin
  foreach tbl in array candidates loop
    if exists (
      select 1 from information_schema.tables
       where table_schema = 'public' and table_name = tbl
    ) then
      execute format('truncate table public.%I restart identity cascade', tbl);
      raise notice 'truncated: %', tbl;
    end if;
  end loop;
end $$;

-- Sanity: per-table row counts after wipe
select 'organization_payments' as t, count(*) from public.organization_payments
union all select 'organizations',          count(*) from public.organizations
union all select 'payments',               count(*) from public.payments
union all select 'retail_sales',           count(*) from public.retail_sales
union all select 'sessions',               count(*) from public.sessions
union all select 'cash_register_closings', count(*) from public.cash_register_closings
union all select 'wallet_transactions',    count(*) from public.wallet_transactions
order by t;
