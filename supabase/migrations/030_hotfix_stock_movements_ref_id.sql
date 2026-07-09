-- ─── 030 — HOTFIX: stock_movements missing ref_id broke ALL retail item writes ─
--
-- Migration 027 added AFTER INSERT triggers on retail_sale_items / retail_waste
-- that write a row into stock_movements(... ref_id ...). But stock_movements
-- already existed in production WITHOUT a ref_id column, so 027's
-- `create table if not exists` was skipped and the column was never added.
-- Result: every retail_sale_items insert raised
--   `column "ref_id" of relation "stock_movements" does not exist`
-- which aborted the whole insert → the sale header was saved but its items were
-- not → phantom sales (total but 0 products), inflated totals, cash surplus.
-- Zayiat with a product was broken the same way.
--
-- FIX:
--   1. Add the missing ref_id column.
--   2. Make both stock triggers resilient — a stock-tracking failure must NEVER
--      abort the sale/waste it is attached to (best-effort ledger).

alter table public.stock_movements add column if not exists ref_id uuid;

create or replace function public.trg_stock_on_sale()
returns trigger language plpgsql security definer set search_path = public as $BODY$
begin
  begin
    update public.products set stock_on_hand = stock_on_hand - new.quantity where id = new.product_id;
    insert into public.stock_movements (product_id, movement_type, delta, reason, ref_id)
      values (new.product_id, 'sale', -new.quantity, 'Perakende satış', new.sale_id);
  exception when others then
    null; -- stock tracking is best-effort; never block the sale
  end;
  return new;
end $BODY$;

create or replace function public.trg_stock_on_waste()
returns trigger language plpgsql security definer set search_path = public as $BODY$
begin
  begin
    if new.product_id is not null then
      update public.products set stock_on_hand = stock_on_hand - new.quantity where id = new.product_id;
      insert into public.stock_movements (product_id, movement_type, delta, reason, ref_id, created_by)
        values (new.product_id, 'waste', -new.quantity, 'Zayiat: ' || coalesce(new.reason,''), new.id, new.created_by);
    end if;
  exception when others then
    null;
  end;
  return new;
end $BODY$;
