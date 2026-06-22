-- ─── Ensure cash_register_closings has all columns close_cash_register writes ─
-- The production table was created from an older schema variant missing
-- closed_by_name + several totals/counted/expected columns. Adding them
-- idempotently lets close_cash_register's UPDATE succeed.
alter table public.cash_register_closings
  add column if not exists closed_by_name    text,
  add column if not exists expected_cash     numeric(10,2) default 0,
  add column if not exists expected_card     numeric(10,2) default 0,
  add column if not exists expected_wallet   numeric(10,2) default 0,
  add column if not exists expected_total    numeric(10,2) default 0,
  add column if not exists counted_cash      numeric(10,2) default 0,
  add column if not exists counted_card      numeric(10,2) default 0,
  add column if not exists counted_wallet    numeric(10,2) default 0,
  add column if not exists refund_total      numeric(10,2) default 0,
  add column if not exists session_count     int default 0,
  add column if not exists transaction_count int default 0,
  add column if not exists notes             text default '',
  add column if not exists meta              jsonb default '{}'::jsonb,
  add column if not exists status            text default 'open',
  add column if not exists branch_id         uuid;
notify pgrst, 'reload schema';
