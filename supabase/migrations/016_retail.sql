-- ─── 016 — Retail Sales Module ──────────────────────────────────────────────
--
-- Lightweight POS for non-session sales: socks, coloring sets, toys, snacks,
-- drinks, future merch.
--
-- Designed so inventory tracking can be bolted on later WITHOUT schema
-- migrations breaking — see the comment near `products.sku` /
-- `products.stock_on_hand` and the placeholder `stock_movements` table.

create extension if not exists pgcrypto;

-- ── 1. Products catalogue ──────────────────────────────────────────────────
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null default 'genel',  -- 'corap','boyama','oyuncak','atistirmalik','icecek','genel'
  sale_price    numeric(10,2) not null default 0,
  cost_price    numeric(10,2),                  -- nullable (margin reports use it later)
  sku           text,                            -- nullable (future barcode / supplier code)
  stock_on_hand int not null default 0,          -- decremented on sale; reserved for future inventory phase
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists products_active_idx on public.products (is_active, sort_order);

alter table public.products enable row level security;

drop policy if exists "products read"  on public.products;
create policy "products read"
  on public.products for select
  to authenticated using (true);

drop policy if exists "products admin write" on public.products;
create policy "products admin write"
  on public.products for all
  to authenticated
  using (exists (select 1 from public.profiles
                  where id = auth.uid() and role in ('admin','super_admin')))
  with check (exists (select 1 from public.profiles
                       where id = auth.uid() and role in ('admin','super_admin')));

-- ── 2. Retail sale headers ─────────────────────────────────────────────────
create table if not exists public.retail_sales (
  id             uuid primary key default gen_random_uuid(),
  sold_at        timestamptz not null default now(),
  cashier_id     uuid references public.profiles(id),
  payment_method text not null check (payment_method in ('cash','card','split')),
  total_amount   numeric(10,2) not null,
  cash_amount    numeric(10,2) not null default 0,
  card_amount    numeric(10,2) not null default 0,
  notes          text,
  voided         boolean not null default false,   -- soft-delete for audit
  voided_at      timestamptz,
  voided_by      uuid references public.profiles(id),
  branch_id      uuid,                              -- nullable, future multi-branch
  created_at     timestamptz not null default now()
);

create index if not exists retail_sales_sold_at_idx on public.retail_sales (sold_at desc);
create index if not exists retail_sales_cashier_idx on public.retail_sales (cashier_id, sold_at desc);

alter table public.retail_sales enable row level security;

drop policy if exists "retail_sales read"  on public.retail_sales;
create policy "retail_sales read"
  on public.retail_sales for select
  to authenticated using (true);

drop policy if exists "retail_sales insert" on public.retail_sales;
create policy "retail_sales insert"
  on public.retail_sales for insert
  to authenticated
  with check (cashier_id = auth.uid());

drop policy if exists "retail_sales admin update" on public.retail_sales;
create policy "retail_sales admin update"
  on public.retail_sales for update
  to authenticated
  using (exists (select 1 from public.profiles
                  where id = auth.uid() and role in ('admin','super_admin')));

-- ── 3. Retail sale line items ──────────────────────────────────────────────
create table if not exists public.retail_sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.retail_sales(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete restrict,
  product_name text not null,                    -- snapshot at sale time
  quantity     int not null check (quantity > 0),
  unit_price   numeric(10,2) not null,
  line_total   numeric(10,2) not null,
  created_at   timestamptz not null default now()
);

create index if not exists retail_sale_items_sale_idx on public.retail_sale_items (sale_id);
create index if not exists retail_sale_items_product_idx on public.retail_sale_items (product_id);

alter table public.retail_sale_items enable row level security;

drop policy if exists "retail_sale_items read"  on public.retail_sale_items;
create policy "retail_sale_items read"
  on public.retail_sale_items for select
  to authenticated using (true);

drop policy if exists "retail_sale_items insert" on public.retail_sale_items;
create policy "retail_sale_items insert"
  on public.retail_sale_items for insert
  to authenticated
  with check (
    exists (select 1 from public.retail_sales s
             where s.id = sale_id and s.cashier_id = auth.uid())
  );

-- ── 4. Inventory-ready placeholder (NOT YET USED — for future phase) ───────
-- A full inventory module would add rows to this table for every stock
-- change. The retail_sales flow could be extended to insert here with
-- movement_type = 'sale' and a negative delta. Left empty for now.
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('sale','restock','adjust','damage','initial')),
  delta         int not null,
  reason        text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

alter table public.stock_movements enable row level security;
drop policy if exists "stock_movements admin all" on public.stock_movements;
create policy "stock_movements admin all"
  on public.stock_movements for all
  to authenticated
  using (exists (select 1 from public.profiles
                  where id = auth.uid() and role in ('admin','super_admin')))
  with check (exists (select 1 from public.profiles
                       where id = auth.uid() and role in ('admin','super_admin')));

-- ── 5. Reporting RPCs (used by Owner Dashboard) ────────────────────────────

-- Today's retail revenue + top sellers in a single fast call.
create or replace function public.retail_today_summary()
returns json
language sql
security definer
set search_path = public
as $$
  with today as (
    select * from public.retail_sales
     where not voided
       and sold_at >= date_trunc('day', now())
  ),
  totals as (
    select
      coalesce(sum(total_amount), 0)               as total_revenue,
      coalesce(sum(cash_amount), 0)                as cash_revenue,
      coalesce(sum(card_amount), 0)                as card_revenue,
      count(*)                                     as tx_count
    from today
  ),
  top_items as (
    select i.product_id, i.product_name,
           sum(i.quantity) as qty, sum(i.line_total) as revenue
      from public.retail_sale_items i
      join today t on t.id = i.sale_id
     group by i.product_id, i.product_name
     order by qty desc
     limit 5
  )
  select json_build_object(
    'totals',     (select row_to_json(totals) from totals),
    'top_items',  coalesce((select json_agg(row_to_json(top_items)) from top_items), '[]'::json)
  );
$$;

grant execute on function public.retail_today_summary() to authenticated;

-- Daily breakdown across ALL revenue sources for the Owner dashboard.
-- Sessions revenue comes from sessions.total_price if it exists; otherwise 0.
-- Memberships and birthdays are placeholders (return 0 until those tables
-- are properly priced — keep the RPC stable so dashboards don't break).
create or replace function public.daily_revenue_breakdown(p_date date default current_date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessions   numeric := 0;
  v_retail     numeric := 0;
  v_birthdays  numeric := 0;
  v_memberships numeric := 0;
begin
  -- Sessions: try `total_price`, fall back to 0 if column is missing.
  begin
    execute format(
      'select coalesce(sum(total_price),0) from public.sessions
        where date(start_time) = %L and (cancelled is null or cancelled = false)',
      p_date::text)
    into v_sessions;
  exception when undefined_column then v_sessions := 0;
  end;

  select coalesce(sum(total_amount),0) into v_retail
    from public.retail_sales
   where not voided and date(sold_at) = p_date;

  return json_build_object(
    'date',         p_date,
    'sessions',     v_sessions,
    'retail',       v_retail,
    'memberships',  v_memberships,
    'birthdays',    v_birthdays,
    'total',        (v_sessions + v_retail + v_memberships + v_birthdays)
  );
end;
$$;

grant execute on function public.daily_revenue_breakdown(date) to authenticated;
