-- Idempotent retail product seed. Run after migration 016.

insert into public.products (name, category, sale_price, sort_order)
select v.name, v.category, v.price, v.sort_order
from (values
  ('Çorap',           'corap',         50.00, 10),
  ('Boyama Seti',     'boyama',       120.00, 20),
  ('Küçük Oyuncak',   'oyuncak',      250.00, 30),
  ('Su',              'icecek',        25.00, 40),
  ('Atıştırmalık',    'atistirmalik',  60.00, 50)
) as v(name, category, price, sort_order)
where not exists (select 1 from public.products p where p.name = v.name);

select name, category, sale_price, is_active from public.products order by sort_order;
