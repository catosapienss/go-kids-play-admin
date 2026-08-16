-- ─── 038 — Birthday packages v2 (STANDART / PREMIUM) + reservation snapshots ─
--
-- PRODUCTION-SAFE, ADDITIVE, NON-DESTRUCTIVE.
--
-- What this migration does:
--   1. Adds nullable columns to `birthday_packages` (weekday/weekend pricing,
--      tier, capacity, add-ons, notes). Existing rows are untouched.
--   2. Archives every currently-active package (is_active = false) so only the
--      two new packages are selectable for NEW reservations. Rows are KEPT —
--      historical reservations still resolve their package name/price via the
--      package_id FK (on delete restrict) and the JOIN in
--      organizations_upcoming.
--   3. Inserts STANDART + PREMIUM (idempotent by name).
--   4. Adds nullable snapshot/breakdown columns to `organizations` so each NEW
--      reservation is fully self-describing (package name, tier, weekday/weekend,
--      base price, adult/child split, extra guests, premium add-ons, discount).
--      Old rows get NULL and the UI falls back to the existing JOIN + total_price.
--
-- What this migration deliberately does NOT do:
--   • It does not modify any existing organization/reservation row.
--   • It does not modify any payment, End-of-Day, or reporting record.
--   • It does not change any RPC. Revenue reports read `organizations.total_price`
--     by `event_date` (get_organization_analytics 025, revenue_by_category 037).
--     New reservations keep writing the full contract total into `total_price`,
--     so birthday revenue continues to flow into every report with zero RPC
--     changes and zero risk of recalculating historical figures.
--   • It does not delete any package. Old packages are archived, not removed.
--
-- Business rules encoded (confirmed with management):
--   • STANDART: included 15 adults + 15 children (30 total). Extra person after
--     30 total guests.
--   • PREMIUM:  included 20 total (parent + child). Extra person after 20.
--   • Extra person: ₺1.000 + %20 KDV = ₺1.200 / person.
--   • Base prices are final (KDV-inclusive as given). Only the extra-person line
--     adds KDV explicitly.

begin;

-- ── 1. birthday_packages — new nullable columns (additive) ──────────────────
alter table public.birthday_packages
  add column if not exists tier                 text,           -- 'standard' | 'premium'
  add column if not exists weekday_price         numeric(10,2),
  add column if not exists weekend_price         numeric(10,2),
  add column if not exists included_adults       int,
  add column if not exists included_children     int,
  add column if not exists included_total        int,
  add column if not exists extra_person_price    numeric(10,2),
  add column if not exists extra_person_vat_pct  numeric(5,2),
  add column if not exists includes              jsonb,          -- string[]
  add column if not exists extras                jsonb,          -- [{key,label,price}]
  add column if not exists important_notes       text;

-- ── 2. Archive every currently-active package ───────────────────────────────
-- Kept, never deleted: historical reservations resolve their package by id.
update public.birthday_packages
   set is_active = false, updated_at = now()
 where is_active = true;

-- ── 3. Insert the two new packages (idempotent by name) ─────────────────────
insert into public.birthday_packages
  (name, description, price, is_active, sort_order,
   tier, weekday_price, weekend_price,
   included_adults, included_children, included_total,
   extra_person_price, extra_person_vat_pct,
   includes, extras, important_notes)
select
  'STANDART PAKET',
  '2 saat oyun alanı · 15 anne + 15 çocuk · self servis ikram',
  12300.00, true, 10,
  'standard', 12300.00, 15000.00,
  15, 15, 30,
  1000.00, 20.00,
  '["2 saat oyun alanı kullanımı","3 termos çay servisi","15 Türk kahvesi","15 çocuk içeceği","Self servis"]'::jsonb,
  '[]'::jsonb,
  'Dışarıdan içecek kabul edilmez (işletmenin izin verdiği ürünler hariç). Oyun alanı doğum günü etkinliğine özel olarak kapatılmaz.'
where not exists (select 1 from public.birthday_packages where name = 'STANDART PAKET');

insert into public.birthday_packages
  (name, description, price, is_active, sort_order,
   tier, weekday_price, weekend_price,
   included_adults, included_children, included_total,
   extra_person_price, extra_person_vat_pct,
   includes, extras, important_notes)
select
  'PREMIUM PAKET',
  '2 saat oyun alanı · konsept dekorasyon · 20 kişi · servis personeli',
  35000.00, true, 20,
  'premium', 35000.00, 40000.00,
  null, null, 20,
  1000.00, 20.00,
  '["Konsept dekorasyon","Oyun alanı personeli eşliğinde yüz boyama","Seçilen konsepte uygun kremalı pasta","Tatlı ve tuzlu kurabiye","3 çeşit günlük menü","Sınırsız çay","Kişi başı Türk kahvesi","Çocuklar için limonata / meyve suyu","2 saat oyun alanı kullanımı","Servis personeli","Masa hazırlığı"]'::jsonb,
  '[{"key":"sugar_paste_cake","label":"Şeker hamuru pasta (kremalı yerine)","price":2500},{"key":"special_concept","label":"Özel konsept seçimi","price":2500}]'::jsonb,
  'Dışarıdan içecek kabul edilmez (işletmenin izin verdiği ürünler hariç). Oyun alanı doğum günü etkinliğine özel olarak kapatılmaz.'
where not exists (select 1 from public.birthday_packages where name = 'PREMIUM PAKET');

-- ── 4. organizations — snapshot + breakdown columns (additive, nullable) ────
-- Each NEW reservation stores its own package snapshot and money breakdown so
-- it is immune to any future package edit. Old rows stay NULL and the UI falls
-- back to the live JOIN + total_price (their historical values are unchanged).
alter table public.organizations
  add column if not exists package_name_snapshot text,
  add column if not exists package_tier          text,           -- 'standard' | 'premium'
  add column if not exists is_weekend            boolean,
  add column if not exists base_price            numeric(10,2),   -- weekday/weekend base chosen
  add column if not exists adult_count           int,
  add column if not exists child_count           int,
  add column if not exists extra_guest_count     int,
  add column if not exists extra_guest_charge    numeric(10,2),
  add column if not exists extras                jsonb,           -- [{key,label,price}]
  add column if not exists extras_total          numeric(10,2),
  add column if not exists discount              numeric(10,2);

commit;

-- Refresh PostgREST schema cache so the new columns are queryable immediately.
notify pgrst, 'reload schema';
