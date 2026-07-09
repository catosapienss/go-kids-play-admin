-- ─── 029 — Atomic retail checkout + manager-only sale void ──────────────────
--
-- BUG being fixed: checkoutSale inserted the retail_sales HEADER first, then the
-- line ITEMS in a second round-trip. If the items insert failed ("tanımlanamayan
-- sorun, tekrar deneyiniz"), the header was already committed → a phantom sale
-- with a total but 0 products. The cashier retries → a second full sale is
-- written → totals double-count and the cash drawer shows a surplus.
--
-- FIX 1 — checkout_retail_sale(): writes header + all items in ONE transaction.
--   If anything fails the whole thing rolls back, so a header can never exist
--   without its items. The stock-decrement trigger still fires inside the txn.
--
-- FIX 2 — void_retail_sale(): manager-only soft-void so an erroneous or phantom
--   sale can be cancelled. Reads already ignore voided rows, so voiding removes
--   it from every total and the cash reconciles. Voiding restocks the items.
--
-- Both are SECURITY DEFINER + additive. Nothing existing is dropped.

-- ── 1. Atomic checkout ──────────────────────────────────────────────────────
create or replace function public.checkout_retail_sale(
  p_cashier_id     uuid,
  p_payment_method text,
  p_total          numeric,
  p_cash           numeric,
  p_card           numeric,
  p_discount_total numeric,
  p_notes          text,
  p_parent_id      uuid,
  p_items          jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_sale_id uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;

  insert into public.retail_sales
    (cashier_id, payment_method, total_amount, cash_amount, card_amount,
     discount_total, notes, parent_id)
  values
    (p_cashier_id, p_payment_method, p_total, p_cash, p_card,
     coalesce(p_discount_total, 0), p_notes, p_parent_id)
  returning id into v_sale_id;

  insert into public.retail_sale_items
    (sale_id, product_id, product_name, quantity, unit_price, line_total,
     original_unit_price, discount_type, discount_value, final_unit_price,
     discount_amount, discount_reason, custom_note, applied_by)
  select
    v_sale_id,
    nullif(it->>'product_id','')::uuid,
    coalesce(nullif(it->>'product_name',''), 'Ürün'),
    coalesce(nullif(it->>'quantity','')::int, 1),
    coalesce(nullif(it->>'unit_price','')::numeric, 0),
    coalesce(nullif(it->>'line_total','')::numeric, 0),
    nullif(it->>'original_unit_price','')::numeric,
    nullif(it->>'discount_type',''),
    nullif(it->>'discount_value','')::numeric,
    nullif(it->>'final_unit_price','')::numeric,
    coalesce(nullif(it->>'discount_amount','')::numeric, 0),
    nullif(it->>'discount_reason',''),
    nullif(it->>'custom_note',''),
    nullif(it->>'applied_by','')::uuid
  from jsonb_array_elements(p_items) as it;

  return v_sale_id;
end $$;
grant execute on function public.checkout_retail_sale(uuid, text, numeric, numeric, numeric, numeric, text, uuid, jsonb) to authenticated;

-- ── 2. Manager-only void ────────────────────────────────────────────────────
create or replace function public.void_retail_sale(
  p_sale_id uuid,
  p_reason  text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_voided boolean;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('manager','admin','super_admin')) then
    raise exception 'not_authorized';
  end if;

  select voided into v_voided from public.retail_sales where id = p_sale_id;
  if v_voided is null then raise exception 'sale_not_found'; end if;
  if v_voided then return; end if;                       -- idempotent

  -- Restore stock for each line item (reverse the sale decrement) + ledger.
  update public.products p
     set stock_on_hand = p.stock_on_hand + agg.qty
  from (
    select product_id, sum(quantity)::int as qty
    from public.retail_sale_items
    where sale_id = p_sale_id and product_id is not null
    group by product_id
  ) agg
  where p.id = agg.product_id;

  insert into public.stock_movements (product_id, movement_type, delta, reason, ref_id, created_by)
    select product_id, 'restock', sum(quantity)::int, 'Satış iptali', p_sale_id, auth.uid()
    from public.retail_sale_items
    where sale_id = p_sale_id and product_id is not null
    group by product_id;

  update public.retail_sales
     set voided    = true,
         voided_at = now(),
         voided_by = auth.uid(),
         notes     = coalesce(notes || ' | ', '') || 'İPTAL' ||
                     case when nullif(p_reason,'') is not null then ': ' || p_reason else '' end
   where id = p_sale_id;
end $$;
grant execute on function public.void_retail_sale(uuid, text) to authenticated;
