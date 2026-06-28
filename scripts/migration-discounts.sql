-- ─── Discount audit table ───────────────────────────────────────────────────
--
-- One row per applied discount. Created ALONGSIDE the payment / session — never
-- mutates existing payments, sessions, or any historical financial row.
--
-- Idempotent: safe to run multiple times.

create table if not exists public.discounts (
  id              uuid        primary key default gen_random_uuid(),
  session_id      uuid        null references public.sessions(id) on delete set null,
  payment_id      uuid        null references public.payments(id) on delete set null,
  parent_id       uuid        null references public.parents(id)  on delete set null,
  organization_id uuid        null,
  discount_type   text        not null check (discount_type in ('percent', 'fixed')),
  discount_value  numeric     not null check (discount_value >= 0),
  discount_amount numeric     not null check (discount_amount >= 0),
  base_amount     numeric     null,
  reason          text        null,
  applied_by      uuid        null references public.profiles(id) on delete set null,
  applied_by_name text        null,
  created_at      timestamptz not null default now()
);

create index if not exists discounts_session_idx     on public.discounts (session_id);
create index if not exists discounts_parent_idx      on public.discounts (parent_id);
create index if not exists discounts_applied_by_idx  on public.discounts (applied_by);
create index if not exists discounts_created_at_idx  on public.discounts (created_at desc);

alter table public.discounts enable row level security;

drop policy if exists "discounts insert auth" on public.discounts;
create policy "discounts insert auth" on public.discounts
  for insert to authenticated
  with check (true);

drop policy if exists "discounts read auth" on public.discounts;
create policy "discounts read auth" on public.discounts
  for select to authenticated
  using (true);

grant select, insert on public.discounts to authenticated;

-- Quick helper view: daily totals (TR timezone)
create or replace view public.discounts_daily as
  select
    (created_at at time zone 'Europe/Istanbul')::date as day,
    count(*)                                            as discount_count,
    sum(discount_amount)                                as discount_total
  from public.discounts
  group by 1
  order by 1 desc;

grant select on public.discounts_daily to authenticated;

-- Reload PostgREST schema so the table is visible immediately.
notify pgrst, 'reload schema';
