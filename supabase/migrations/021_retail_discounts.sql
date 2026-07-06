-- ─── 021 — Retail Discounts & Manual Price Override ─────────────────────────
--
-- Retail products (socks, coloring sets, drinks, …) can now be sold with a
-- per-line discount or a manual price override. Applies ONLY to retail — play
-- session pricing is untouched.
--
-- The product's list price is NEVER changed. Each sale line stores the original
-- price alongside the effective price + discount metadata, so history is fully
-- auditable and existing reports (which read unit_price / line_total) keep
-- working because those now hold the EFFECTIVE (charged) values.
--
-- Additive + idempotent — safe on the live database.

-- ── 1. Per-line discount detail on retail_sale_items ────────────────────────
alter table public.retail_sale_items
  add column if not exists original_unit_price numeric(10,2),   -- product list price at sale time
  add column if not exists discount_type       text,            -- 'fixed' | 'percent' | 'override' | null
  add column if not exists discount_value       numeric(10,2),  -- raw input (₺ off, %, or override price)
  add column if not exists final_unit_price     numeric(10,2),  -- effective charged unit price
  add column if not exists discount_amount      numeric(10,2) not null default 0,  -- (orig-final)*qty
  add column if not exists discount_reason      text,
  add column if not exists custom_note          text,
  add column if not exists applied_by           uuid references public.profiles(id) on delete set null;

-- Optional guard for the discount type values (allows null = no discount).
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
     where table_name = 'retail_sale_items' and constraint_name = 'retail_sale_items_discount_type_chk'
  ) then
    alter table public.retail_sale_items
      add constraint retail_sale_items_discount_type_chk
      check (discount_type is null or discount_type in ('fixed','percent','override'));
  end if;
end $$;

create index if not exists retail_sale_items_discount_idx
  on public.retail_sale_items (discount_reason)
  where discount_reason is not null;

-- ── 2. Aggregate discount on the sale header (fast reporting) ────────────────
alter table public.retail_sales
  add column if not exists discount_total numeric(10,2) not null default 0;

-- Backfill: existing sales had no discounts → original == final, zero discount.
update public.retail_sale_items
   set original_unit_price = coalesce(original_unit_price, unit_price),
       final_unit_price    = coalesce(final_unit_price, unit_price)
 where original_unit_price is null or final_unit_price is null;
