-- ─── 018 — Birthday organizations (real reservations) ──────────────────────
--
-- Lightweight reservation model wired to the birthday_packages catalog.
-- One row per booked party. Status flows: pending → confirmed → completed
-- (or cancelled at any point). Cashier/staff can create; only admin can
-- delete a booking once confirmed (soft policy via UPDATE allowed for all,
-- DELETE admin-only).

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  child_name    text not null,
  child_age     int,
  parent_id     uuid references public.parents(id) on delete set null,
  parent_name   text not null,
  parent_phone  text,
  package_id    uuid references public.birthday_packages(id) on delete restrict,
  event_date    date not null,
  event_time    time,
  guest_count   int not null default 0,
  total_price   numeric(10,2) not null default 0,
  status        text not null default 'pending'
                check (status in ('pending','confirmed','completed','cancelled')),
  notes         text,
  branch_id     uuid,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists organizations_event_date_idx on public.organizations (event_date);
create index if not exists organizations_status_idx     on public.organizations (status, event_date);
create index if not exists organizations_parent_idx     on public.organizations (parent_id) where parent_id is not null;

alter table public.organizations enable row level security;

drop policy if exists "organizations read" on public.organizations;
create policy "organizations read"
  on public.organizations for select
  to authenticated using (true);

drop policy if exists "organizations insert" on public.organizations;
create policy "organizations insert"
  on public.organizations for insert
  to authenticated with check (auth.uid() is not null);

drop policy if exists "organizations update" on public.organizations;
create policy "organizations update"
  on public.organizations for update
  to authenticated using (auth.uid() is not null);

drop policy if exists "organizations admin delete" on public.organizations;
create policy "organizations admin delete"
  on public.organizations for delete
  to authenticated using (
    exists (select 1 from public.profiles
             where id = auth.uid() and role in ('admin','super_admin'))
  );

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.organizations;
  exception when duplicate_object then null;
  end;
end$$;

-- Today + upcoming convenience view
create or replace view public.organizations_upcoming as
  select o.*,
         p.name as package_name,
         p.price as package_price
    from public.organizations o
    left join public.birthday_packages p on p.id = o.package_id
   where o.event_date >= current_date
     and o.status <> 'cancelled'
   order by o.event_date, o.event_time nulls last;

grant select on public.organizations_upcoming to authenticated;
