-- ─── 035 — Monthly memberships (single + sibling) + summer bonus campaign ────
--
-- Additive & backwards-compatible. Nothing existing is deleted, reset, or
-- rewritten. Adds owner-editable config (packages + campaigns), per-child
-- weekend-minute tracking, and the RPCs that enforce the rules. All day/weekday
-- logic is computed in Europe/Istanbul.
--
-- Business rules (defaults, all editable later by the owner):
--   • Aylık Üyelik ₺8.990 · 1 child · 30 gün · hafta içi sınırsız · hafta sonu
--     180 dk/çocuk/gün · %10 Brewmood indirimi.
--   • 2 Kardeş Aylık Üyelik ₺16.000 · 2 çocuk · her çocuk bağımsız 180 dk hafta
--     sonu · Brewmood indirimi ebeveyne bir kez.
--   • Kampanya "Pazartesi ve Çarşamba 30 Dakika Hediye": Pzt/Çrş 60 dk alana +30
--     dk hediye (toplam 90), ücret yalnızca 60 dk. Bonus dakikalar gelir DEĞİL.

create extension if not exists pgcrypto;

-- ── 1. Membership package config (owner-editable) ───────────────────────────
create table if not exists public.membership_packages (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  price                numeric(10,2) not null default 0,
  included_children    int not null default 1,
  validity_days        int not null default 30,
  weekday_unlimited    boolean not null default true,
  weekend_daily_minutes int not null default 180,
  brewmood_discount_pct numeric(5,2) not null default 10,
  active               boolean not null default true,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

insert into public.membership_packages (name, price, included_children, validity_days, weekday_unlimited, weekend_daily_minutes, brewmood_discount_pct, sort_order)
select 'Aylık Üyelik', 8990, 1, 30, true, 180, 10, 1
where not exists (select 1 from public.membership_packages where name = 'Aylık Üyelik');

insert into public.membership_packages (name, price, included_children, validity_days, weekday_unlimited, weekend_daily_minutes, brewmood_discount_pct, sort_order)
select '2 Kardeş Aylık Üyelik', 16000, 2, 30, true, 180, 10, 2
where not exists (select 1 from public.membership_packages where name = '2 Kardeş Aylık Üyelik');

-- ── 2. memberships — snapshot columns (rules frozen at sale time) ────────────
alter table public.memberships add column if not exists package_id            uuid references public.membership_packages(id) on delete set null;
alter table public.memberships add column if not exists price                 numeric(10,2);
alter table public.memberships add column if not exists payment_method        text;
alter table public.memberships add column if not exists weekday_unlimited     boolean;
alter table public.memberships add column if not exists weekend_daily_minutes int;
alter table public.memberships add column if not exists brewmood_discount_pct numeric(5,2);
alter table public.memberships add column if not exists sold_by               uuid;
alter table public.memberships add column if not exists sold_by_name          text;

-- ── 3. membership_children — 1 or 2 children per membership ──────────────────
create table if not exists public.membership_children (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  child_id      uuid not null references public.children(id) on delete cascade,
  primary key (membership_id, child_id)
);
create index if not exists membership_children_child_idx on public.membership_children (child_id);

-- ── 4. Per-child, per-day weekend minute ledger ─────────────────────────────
create table if not exists public.membership_weekend_usage (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  child_id      uuid not null references public.children(id) on delete cascade,
  usage_date    date not null,
  minutes_used  int  not null default 0,
  updated_at    timestamptz not null default now(),
  unique (membership_id, child_id, usage_date)
);

-- ── 5. Campaigns config (owner-editable) ────────────────────────────────────
create table if not exists public.campaigns (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  eligible_weekdays           int[] not null default '{1,3}',   -- 0=Sun..6=Sat
  eligible_package_minutes    int not null default 60,
  bonus_minutes               int not null default 30,
  starts_on                   date,
  ends_on                     date,
  active                      boolean not null default true,
  for_new_registrations       boolean not null default true,
  for_extensions              boolean not null default false,
  combinable_with_memberships boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

insert into public.campaigns (name, eligible_weekdays, eligible_package_minutes, bonus_minutes, for_new_registrations)
select 'Pazartesi ve Çarşamba 30 Dakika Hediye', '{1,3}', 60, 30, true
where not exists (select 1 from public.campaigns where name = 'Pazartesi ve Çarşamba 30 Dakika Hediye');

-- ── 6. sessions — campaign / membership breakdown (additive, nullable) ──────
alter table public.sessions add column if not exists purchased_minutes int;
alter table public.sessions add column if not exists bonus_minutes     int default 0;
alter table public.sessions add column if not exists total_minutes     int;
alter table public.sessions add column if not exists campaign_id       uuid;
alter table public.sessions add column if not exists campaign_name     text;
alter table public.sessions add column if not exists membership_id     uuid;

-- ── 7. RLS (read = tolerant single-shop pattern; writes via RPC) ────────────
do $$
declare t text;
begin
  foreach t in array array['membership_packages','membership_children','membership_weekend_usage','campaigns'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select to authenticated using (true)', t, t);
  end loop;
end $$;

-- ── 8. RPC: today's membership status for a child (Europe/Istanbul) ──────────
create or replace function public.membership_status_for_child(p_child_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m record; v_dow int; v_today date; v_used int; v_remaining int; v_pkg record;
begin
  v_dow   := extract(dow from (now() at time zone 'Europe/Istanbul'))::int;   -- 0=Sun..6=Sat
  v_today := (now() at time zone 'Europe/Istanbul')::date;

  select mem.* into m
  from public.memberships mem
  where mem.status = 'active'
    and (mem.end_at is null or mem.end_at > now())
    and (
      exists (select 1 from public.membership_children mc where mc.membership_id = mem.id and mc.child_id = p_child_id)
      or mem.child_id = p_child_id
    )
  order by mem.start_at desc
  limit 1;

  if m.id is null then
    return jsonb_build_object('has_membership', false);
  end if;

  select * into v_pkg from public.membership_packages where id = m.package_id;

  if v_dow between 1 and 5 and coalesce(m.weekday_unlimited, true) then
    return jsonb_build_object(
      'has_membership', true, 'membership_id', m.id, 'is_weekday_unlimited', true,
      'package_name', coalesce(v_pkg.name, ''), 'ends_at', m.end_at,
      'brewmood_discount_pct', coalesce(m.brewmood_discount_pct, v_pkg.brewmood_discount_pct, 0),
      'included_children', coalesce(v_pkg.included_children, 1)
    );
  end if;

  -- weekend (or weekday_unlimited disabled) → minute allowance
  select coalesce(minutes_used, 0) into v_used
    from public.membership_weekend_usage
    where membership_id = m.id and child_id = p_child_id and usage_date = v_today;
  v_remaining := coalesce(m.weekend_daily_minutes, 180) - coalesce(v_used, 0);

  return jsonb_build_object(
    'has_membership', true, 'membership_id', m.id, 'is_weekday_unlimited', false,
    'weekend_remaining_minutes', greatest(0, v_remaining),
    'weekend_daily_minutes', coalesce(m.weekend_daily_minutes, 180),
    'package_name', coalesce(v_pkg.name, ''), 'ends_at', m.end_at,
    'brewmood_discount_pct', coalesce(m.brewmood_discount_pct, v_pkg.brewmood_discount_pct, 0),
    'included_children', coalesce(v_pkg.included_children, 1)
  );
end $$;
grant execute on function public.membership_status_for_child(uuid) to authenticated;

-- ── 9. RPC: record weekend minutes (reject over the daily cap) ──────────────
create or replace function public.record_membership_weekend_usage(
  p_membership_id uuid, p_child_id uuid, p_minutes int
) returns int
language plpgsql security definer set search_path = public as $$
declare v_today date; v_cap int; v_new int;
begin
  v_today := (now() at time zone 'Europe/Istanbul')::date;
  select coalesce(weekend_daily_minutes, 180) into v_cap from public.memberships where id = p_membership_id;
  if v_cap is null then raise exception 'membership_not_found'; end if;

  insert into public.membership_weekend_usage (membership_id, child_id, usage_date, minutes_used)
    values (p_membership_id, p_child_id, v_today, greatest(0, p_minutes))
  on conflict (membership_id, child_id, usage_date)
    do update set minutes_used = public.membership_weekend_usage.minutes_used + greatest(0, p_minutes), updated_at = now()
  returning minutes_used into v_new;

  if v_new > v_cap then
    raise exception 'weekend_limit_exceeded';
  end if;
  return v_new;
end $$;
grant execute on function public.record_membership_weekend_usage(uuid, uuid, int) to authenticated;

-- ── 10. RPC: applicable campaign for a new registration ─────────────────────
create or replace function public.applicable_campaign(
  p_package_minutes int, p_at timestamptz default now()
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c record; v_dow int; v_date date;
begin
  v_dow  := extract(dow from (p_at at time zone 'Europe/Istanbul'))::int;
  v_date := (p_at at time zone 'Europe/Istanbul')::date;
  select * into c from public.campaigns
   where active
     and for_new_registrations
     and eligible_package_minutes = p_package_minutes
     and v_dow = any(eligible_weekdays)
     and (starts_on is null or v_date >= starts_on)
     and (ends_on   is null or v_date <= ends_on)
   order by created_at desc
   limit 1;
  if c.id is null then return jsonb_build_object('applies', false); end if;
  return jsonb_build_object('applies', true, 'campaign_id', c.id, 'campaign_name', c.name, 'bonus_minutes', c.bonus_minutes);
end $$;
grant execute on function public.applicable_campaign(int, timestamptz) to authenticated;

-- ── 11. RPC: sell a membership (manager+), validate child count/ownership ────
create or replace function public.sell_membership(
  p_package_id uuid,
  p_parent_id  uuid,
  p_child_ids  uuid[],
  p_cash numeric default 0,
  p_card numeric default 0,
  p_wallet numeric default 0,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_pkg record; v_name text; v_mid uuid; v_cid uuid; v_method text; v_total numeric(10,2);
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('manager','admin','super_admin')) then
    raise exception 'not_authorized';
  end if;
  select * into v_pkg from public.membership_packages where id = p_package_id and active;
  if v_pkg.id is null then raise exception 'package_not_found'; end if;
  if array_length(p_child_ids, 1) is distinct from v_pkg.included_children then
    raise exception 'child_count_mismatch';
  end if;
  -- all children must belong to the parent
  if exists (
    select 1 from unnest(p_child_ids) cid
    where not exists (select 1 from public.children ch where ch.id = cid and ch.parent_id = p_parent_id)
  ) then
    raise exception 'child_not_owned';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  v_total  := coalesce(p_cash,0) + coalesce(p_card,0) + coalesce(p_wallet,0);
  v_method := case when coalesce(p_card,0) > 0 and coalesce(p_cash,0) > 0 then 'split'
                   when coalesce(p_card,0) > 0 then 'card'
                   when coalesce(p_wallet,0) > 0 then 'wallet'
                   else 'cash' end;

  insert into public.memberships
    (parent_id, child_id, membership_type, status, start_at, end_at, notes,
     package_id, price, payment_method, weekday_unlimited, weekend_daily_minutes,
     brewmood_discount_pct, sold_by, sold_by_name)
  values
    (p_parent_id,
     case when v_pkg.included_children = 1 then p_child_ids[1] else null end,
     'monthly', 'active', now(), now() + (v_pkg.validity_days || ' days')::interval, p_notes,
     p_package_id, coalesce(v_total, v_pkg.price), v_method, v_pkg.weekday_unlimited, v_pkg.weekend_daily_minutes,
     v_pkg.brewmood_discount_pct, auth.uid(), v_name)
  returning id into v_mid;

  foreach v_cid in array p_child_ids loop
    insert into public.membership_children (membership_id, child_id) values (v_mid, v_cid)
      on conflict do nothing;
  end loop;

  return v_mid;
end $$;
grant execute on function public.sell_membership(uuid, uuid, uuid[], numeric, numeric, numeric, text) to authenticated;

-- ── 12. Owner-only config upserts ───────────────────────────────────────────
create or replace function public.upsert_membership_package(
  p_id uuid, p_name text, p_price numeric, p_included_children int, p_validity_days int,
  p_weekday_unlimited boolean, p_weekend_daily_minutes int, p_brewmood_discount_pct numeric, p_active boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin')) then
    raise exception 'not_authorized';
  end if;
  if p_id is null then
    insert into public.membership_packages (name, price, included_children, validity_days, weekday_unlimited, weekend_daily_minutes, brewmood_discount_pct, active)
      values (p_name, p_price, p_included_children, p_validity_days, p_weekday_unlimited, p_weekend_daily_minutes, p_brewmood_discount_pct, coalesce(p_active,true))
      returning id into v_id;
  else
    update public.membership_packages set
      name=p_name, price=p_price, included_children=p_included_children, validity_days=p_validity_days,
      weekday_unlimited=p_weekday_unlimited, weekend_daily_minutes=p_weekend_daily_minutes,
      brewmood_discount_pct=p_brewmood_discount_pct, active=coalesce(p_active,true), updated_at=now()
    where id=p_id returning id into v_id;
  end if;
  return v_id;
end $$;
grant execute on function public.upsert_membership_package(uuid, text, numeric, int, int, boolean, int, numeric, boolean) to authenticated;

create or replace function public.upsert_campaign(
  p_id uuid, p_name text, p_eligible_weekdays int[], p_eligible_package_minutes int, p_bonus_minutes int,
  p_starts_on date, p_ends_on date, p_active boolean, p_for_new_registrations boolean,
  p_for_extensions boolean, p_combinable_with_memberships boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin')) then
    raise exception 'not_authorized';
  end if;
  if p_id is null then
    insert into public.campaigns (name, eligible_weekdays, eligible_package_minutes, bonus_minutes, starts_on, ends_on, active, for_new_registrations, for_extensions, combinable_with_memberships)
      values (p_name, p_eligible_weekdays, p_eligible_package_minutes, p_bonus_minutes, p_starts_on, p_ends_on, coalesce(p_active,true), coalesce(p_for_new_registrations,true), coalesce(p_for_extensions,false), coalesce(p_combinable_with_memberships,false))
      returning id into v_id;
  else
    update public.campaigns set
      name=p_name, eligible_weekdays=p_eligible_weekdays, eligible_package_minutes=p_eligible_package_minutes,
      bonus_minutes=p_bonus_minutes, starts_on=p_starts_on, ends_on=p_ends_on, active=coalesce(p_active,true),
      for_new_registrations=coalesce(p_for_new_registrations,true), for_extensions=coalesce(p_for_extensions,false),
      combinable_with_memberships=coalesce(p_combinable_with_memberships,false), updated_at=now()
    where id=p_id returning id into v_id;
  end if;
  return v_id;
end $$;
grant execute on function public.upsert_campaign(uuid, text, int[], int, int, date, date, boolean, boolean, boolean, boolean) to authenticated;
