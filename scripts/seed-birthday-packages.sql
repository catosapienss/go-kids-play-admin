-- Idempotent default birthday packages. Run once after migration 015.
-- Admin can edit / remove them later from /dogum-gunleri.

insert into public.birthday_packages (name, description, price, is_active, sort_order)
select v.name, v.description, v.price, true, v.sort_order
from (values
  ('Bronz Paket',
   '2 saat oyun alanı kullanımı · 10 çocuk · pasta + ikram · standart dekorasyon',
   3500.00, 10),
  ('Gümüş Paket',
   '3 saat oyun alanı kullanımı · 15 çocuk · özel pasta + ikram · tematik dekorasyon · animatör (1 saat)',
   5500.00, 20),
  ('Altın Paket',
   '4 saat oyun alanı + özel salon · 25 çocuk · butik pasta + zengin ikram menüsü · profesyonel dekorasyon · animatör (full session) · fotoğraf çekimi',
   8500.00, 30)
) as v(name, description, price, sort_order)
where not exists (
  select 1 from public.birthday_packages b where b.name = v.name
);

select name, price, is_active from public.birthday_packages order by sort_order;
