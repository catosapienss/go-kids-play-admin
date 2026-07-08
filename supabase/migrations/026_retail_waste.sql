-- ─── 026 — Retail Waste / Loss (Zayiat) ─────────────────────────────────────
--
-- Tracks retail stock that can no longer be sold — damaged, expired, lost/
-- stolen, count differences, samples/comps. This is a COST/loss record, kept
-- independent of sales revenue. Does NOT touch products.stock_on_hand (the
-- inventory phase isn't active yet); it's a standalone auditable loss ledger,
-- surfaced on /perakende and in Reports.
--
-- Additive + idempotent — safe on the live database.

create extension if not exists pgcrypto;

create table if not exists public.retail_waste (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references public.products(id) on delete set null,
  product_name    text not null,                       -- snapshot at waste time
  quantity        int  not null check (quantity > 0),
  unit_cost       numeric(10,2) not null default 0,    -- valuation per unit (cost or sale price)
  total_cost      numeric(10,2) not null default 0,    -- quantity * unit_cost
  reason          text not null check (reason in ('damaged','expired','theft','count_diff','sample','other')),
  note            text,
  branch_id       uuid,
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);

create index if not exists retail_waste_created_idx on public.retail_waste (created_at desc);
create index if not exists retail_waste_reason_idx  on public.retail_waste (reason);
create index if not exists retail_waste_product_idx on public.retail_waste (product_id);

alter table public.retail_waste enable row level security;

-- Read: any authenticated user (the app scopes to branch/day).
drop policy if exists "retail_waste read" on public.retail_waste;
create policy "retail_waste read"
  on public.retail_waste for select
  to authenticated using (true);

-- Insert: staff may record a loss, attributed to themselves.
drop policy if exists "retail_waste insert" on public.retail_waste;
create policy "retail_waste insert"
  on public.retail_waste for insert
  to authenticated
  with check (created_by = auth.uid());

-- Delete: the creator OR a manager/admin/owner (correcting a mistaken entry).
drop policy if exists "retail_waste delete" on public.retail_waste;
create policy "retail_waste delete"
  on public.retail_waste for delete
  to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles
                where id = auth.uid() and role in ('manager','admin','super_admin'))
  );
