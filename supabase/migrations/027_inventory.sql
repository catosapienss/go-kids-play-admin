-- ─── 027 — Inventory / Stock Tracking ──────────────────────────────────────
--
-- Manager-only stock control:
--   • products.stock_on_hand is the live quantity.
--   • Every retail SALE and every ZAYIAT (waste) auto-decrements stock via
--     BEFORE/AFTER triggers — server-side, so it's reliable regardless of the
--     client. A movement row is written for a full audit trail.
--   • Managers restock (+) and run a monthly physical COUNT that sets each
--     product's quantity to the counted value and books the difference.
--
-- Sales are NEVER blocked by stock (quantity may go negative → the count
-- corrects it). Additive + idempotent — safe on the live database.

create extension if not exists pgcrypto;

alter table public.products add column if not exists stock_on_hand int not null default 0;

-- ── 1. Movement ledger ──────────────────────────────────────────────────────
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references public.products(id) on delete cascade,
  movement_type text not null,           -- sale | waste | restock | count_adjust | initial | manual
  delta         int  not null,           -- signed (− out, + in)
  reason        text,
  ref_id        uuid,                    -- originating sale item / waste / count
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
-- Broaden the movement_type check if an older (016) constraint exists.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.stock_movements'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%movement_type%';
  if c is not null then execute format('alter table public.stock_movements drop constraint %I', c); end if;
  alter table public.stock_movements
    add constraint stock_movements_type_chk
    check (movement_type in ('sale','waste','restock','count_adjust','initial','manual','adjust','damage'));
exception when others then null;
end $$;

create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

alter table public.stock_movements enable row level security;
drop policy if exists "stock_movements read" on public.stock_movements;
create policy "stock_movements read" on public.stock_movements for select to authenticated using (true);

-- ── 2. Auto-decrement on retail SALE ────────────────────────────────────────
create or replace function public.trg_stock_on_sale()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.products set stock_on_hand = stock_on_hand - new.quantity where id = new.product_id;
  insert into public.stock_movements (product_id, movement_type, delta, reason, ref_id)
    values (new.product_id, 'sale', -new.quantity, 'Perakende satış', new.sale_id);
  return new;
end $$;

drop trigger if exists trg_stock_on_sale on public.retail_sale_items;
create trigger trg_stock_on_sale
  after insert on public.retail_sale_items
  for each row execute function public.trg_stock_on_sale();

-- ── 3. Auto-decrement on ZAYIAT (waste) ─────────────────────────────────────
create or replace function public.trg_stock_on_waste()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null then
    update public.products set stock_on_hand = stock_on_hand - new.quantity where id = new.product_id;
    insert into public.stock_movements (product_id, movement_type, delta, reason, ref_id, created_by)
      values (new.product_id, 'waste', -new.quantity, 'Zayiat: ' || coalesce(new.reason,''), new.id, new.created_by);
  end if;
  return new;
end $$;

drop trigger if exists trg_stock_on_waste on public.retail_waste;
create trigger trg_stock_on_waste
  after insert on public.retail_waste
  for each row execute function public.trg_stock_on_waste();

-- ── 4. Manager adjust / restock RPC ─────────────────────────────────────────
create or replace function public.adjust_stock(
  p_product_id uuid, p_delta int, p_type text default 'manual', p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('manager','admin','super_admin')) then
    raise exception 'not_authorized';
  end if;
  update public.products set stock_on_hand = stock_on_hand + p_delta where id = p_product_id;
  insert into public.stock_movements (product_id, movement_type, delta, reason, created_by)
    values (p_product_id, coalesce(p_type,'manual'), p_delta, p_reason, auth.uid());
end $$;
grant execute on function public.adjust_stock(uuid, int, text, text) to authenticated;

-- ── 5. Monthly physical count ───────────────────────────────────────────────
create table if not exists public.stock_counts (
  id            uuid primary key default gen_random_uuid(),
  status        text not null default 'open' check (status in ('open','completed')),
  started_by    uuid references public.profiles(id) on delete set null,
  started_by_name text,
  note          text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create table if not exists public.stock_count_items (
  id           uuid primary key default gen_random_uuid(),
  count_id     uuid not null references public.stock_counts(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  system_qty   int not null default 0,     -- stock_on_hand snapshot at count start
  counted_qty  int,                        -- entered by the manager
  created_at   timestamptz not null default now()
);
create index if not exists stock_count_items_count_idx on public.stock_count_items (count_id);

alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;
drop policy if exists "stock_counts read" on public.stock_counts;
create policy "stock_counts read" on public.stock_counts for select to authenticated using (true);
drop policy if exists "stock_count_items read" on public.stock_count_items;
create policy "stock_count_items read" on public.stock_count_items for select to authenticated using (true);

-- Start a count: snapshot every active product's current quantity. Returns id.
create or replace function public.start_stock_count(p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('manager','admin','super_admin')) then
    raise exception 'not_authorized';
  end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.stock_counts (started_by, started_by_name, note)
    values (auth.uid(), v_name, p_note) returning id into v_id;
  insert into public.stock_count_items (count_id, product_id, product_name, system_qty)
    select v_id, p.id, p.name, coalesce(p.stock_on_hand, 0)
    from public.products p where p.is_active = true;
  return v_id;
end $$;
grant execute on function public.start_stock_count(text) to authenticated;

-- Apply a count: set each counted product's stock to the counted value and
-- book the difference as a 'count_adjust' movement. Marks the count completed.
create or replace function public.apply_stock_count(p_count_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_old int; v_delta int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('manager','admin','super_admin')) then
    raise exception 'not_authorized';
  end if;
  for r in select * from public.stock_count_items where count_id = p_count_id and counted_qty is not null and product_id is not null loop
    select stock_on_hand into v_old from public.products where id = r.product_id;
    v_delta := r.counted_qty - coalesce(v_old, 0);
    update public.products set stock_on_hand = r.counted_qty where id = r.product_id;
    if v_delta <> 0 then
      insert into public.stock_movements (product_id, movement_type, delta, reason, ref_id, created_by)
        values (r.product_id, 'count_adjust', v_delta, 'Aylık sayım düzeltmesi', p_count_id, auth.uid());
    end if;
  end loop;
  update public.stock_counts set status = 'completed', completed_at = now() where id = p_count_id;
end $$;
grant execute on function public.apply_stock_count(uuid) to authenticated;
