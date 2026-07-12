-- ─── 032 — Invoice-based stock entry (supplier purchase invoices) ────────────
--
-- Workflow: supplier invoice → admin/manager enters it → products+quantities are
-- added → current stock increases. Retail sales already auto-decrement stock
-- (migrations 027/030) and voids restore it (029), so this closes the loop on
-- the "stock in" side. Also adds products.min_stock for low-stock alerts.
--
-- Manager-gated, atomic (invoice + items + stock bump in one transaction),
-- additive. Nothing existing is dropped.

alter table public.products add column if not exists min_stock int not null default 0;

-- ── Invoice header ──────────────────────────────────────────────────────────
create table if not exists public.stock_invoices (
  id              uuid primary key default gen_random_uuid(),
  supplier_name   text,
  invoice_no      text,
  note            text,
  total_cost      numeric(12,2) not null default 0,
  item_count      int not null default 0,
  branch_id       uuid,
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);
create index if not exists stock_invoices_created_idx on public.stock_invoices (created_at desc);

-- ── Invoice line items ──────────────────────────────────────────────────────
create table if not exists public.stock_invoice_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.stock_invoices(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity     int  not null check (quantity > 0),
  unit_cost    numeric(10,2) not null default 0,
  line_cost    numeric(12,2) not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists stock_invoice_items_invoice_idx on public.stock_invoice_items (invoice_id);

alter table public.stock_invoices enable row level security;
alter table public.stock_invoice_items enable row level security;
drop policy if exists "stock_invoices read" on public.stock_invoices;
create policy "stock_invoices read" on public.stock_invoices for select to authenticated using (true);
drop policy if exists "stock_invoice_items read" on public.stock_invoice_items;
create policy "stock_invoice_items read" on public.stock_invoice_items for select to authenticated using (true);

-- ── RPC: record an invoice atomically + bump stock + ledger ─────────────────
create or replace function public.record_stock_invoice(
  p_supplier   text,
  p_invoice_no text,
  p_note       text,
  p_items      jsonb   -- [{product_id, product_name, quantity, unit_cost}]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_name text; v_total numeric(12,2) := 0; v_count int := 0;
  it jsonb; v_pid uuid; v_qty int; v_cost numeric(10,2);
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('manager','admin','super_admin')) then
    raise exception 'not_authorized';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_invoice';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.stock_invoices (supplier_name, invoice_no, note, created_by, created_by_name)
    values (nullif(btrim(p_supplier),''), nullif(btrim(p_invoice_no),''), nullif(btrim(p_note),''), auth.uid(), v_name)
    returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_pid  := nullif(it->>'product_id','')::uuid;
    v_qty  := coalesce(nullif(it->>'quantity','')::int, 0);
    v_cost := coalesce(nullif(it->>'unit_cost','')::numeric, 0);
    if v_pid is null or v_qty <= 0 then continue; end if;

    insert into public.stock_invoice_items (invoice_id, product_id, product_name, quantity, unit_cost, line_cost)
      values (v_id, v_pid,
              coalesce(nullif(it->>'product_name',''), (select name from public.products where id = v_pid), 'Ürün'),
              v_qty, v_cost, v_qty * v_cost);

    update public.products set stock_on_hand = coalesce(stock_on_hand,0) + v_qty where id = v_pid;

    insert into public.stock_movements (product_id, movement_type, delta, reason, ref_id, created_by)
      values (v_pid, 'restock', v_qty,
              'Fatura' || coalesce(' #' || nullif(btrim(p_invoice_no),''), '') , v_id, auth.uid());

    v_total := v_total + v_qty * v_cost;
    v_count := v_count + v_qty;
  end loop;

  update public.stock_invoices set total_cost = v_total, item_count = v_count where id = v_id;
  return v_id;
end $$;
grant execute on function public.record_stock_invoice(text, text, text, jsonb) to authenticated;
