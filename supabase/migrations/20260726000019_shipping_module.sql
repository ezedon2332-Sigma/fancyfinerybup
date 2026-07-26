-- Fancy Finery — shipping module: fine-grained weight ladder + product
-- shipping attributes.
--
-- 1. The ladder becomes uniform 0.5 kg steps from 0 to 50 kg (100 bands).
--    Published prices up to 5 kg are unchanged — each published band simply
--    spans several 0.5 kg steps at the same price, which the rates page
--    merges back for display. Finer storage means a band can later be priced
--    individually without another migration.
--
-- 2. The flat "20 kg +" band is REMOVED. An open-ended band quotes a 60 kg
--    consignment at the 21 kg price, which is a real financial exposure on
--    freight-sized orders. Above 50 kg there is deliberately no table rate:
--    the engine declines, and checkout directs the customer to request a
--    freight quote.
--
-- 3. Products gain full dimensional and handling attributes so packaging,
--    dimensional weight and carrier APIs have something to work from.

-- Product shipping attributes ------------------------------------------------
alter table public.products
  add column if not exists length_mm integer not null default 0 check (length_mm >= 0),
  add column if not exists width_mm  integer not null default 0 check (width_mm  >= 0),
  add column if not exists height_mm integer not null default 0 check (height_mm >= 0),
  add column if not exists shipping_class text not null default 'standard'
    check (shipping_class in ('standard', 'fragile', 'oversized', 'hazardous', 'jewellery')),
  add column if not exists is_fragile boolean not null default false,
  add column if not exists is_oversized boolean not null default false,
  add column if not exists ships_separately boolean not null default false,
  add column if not exists free_shipping_eligible boolean not null default false,
  add column if not exists warehouse_location text,
  add column if not exists country_of_origin text;

create index if not exists products_shipping_class_idx
  on public.products (shipping_class);
create index if not exists products_ships_separately_idx
  on public.products (ships_separately) where ships_separately;

-- Rebuild the weight ladder ----------------------------------------------------
-- Rates cascade from brackets. Prices are re-derived below from the published
-- card, so clearing here loses nothing that is not immediately restored.
delete from public.shipping_rates;
delete from public.shipping_weight_brackets;

-- 100 bands: 0–0.5, 0.5–1, … 49.5–50 kg.
insert into public.shipping_weight_brackets (label, min_grams, max_grams, sort_order)
select
  format(
    '%s – %s kg',
    trim(to_char(s.step * 0.5 - 0.5, 'FM990.9')),
    trim(to_char(s.step * 0.5,       'FM990.9'))
  ),
  ((s.step - 1) * 500)::int,
  (s.step * 500)::int,
  s.step
from generate_series(1, 100) as s(step);
-- No band above 50 kg on purpose — see note 2.

-- Re-apply the published card across the finer ladder ---------------------------
-- `base_naira` is the published 4–5 kg price and `per_kg_naira` the rate implied
-- by each country's own progression; together they price every band above 5 kg.
with card(country_code, base_naira, per_kg_naira) as (
  values
    ('AU', 201000, 24000), ('FI', 160000, 20000), ('MX', 171000, 23000),
    ('ZW', 194000, 25000), ('ZA', 147000, 19000), ('US', 173000, 22000),
    ('CA', 173000, 22000), ('GB', 150000, 19000), ('NL', 157000, 20000),
    ('FR', 158000, 20000)
),
-- Published bands up to 5 kg, as (upper bound in grams, price).
published(country_code, upper_grams, price_naira) as (
  values
    ('AU', 2000, 129000), ('AU', 3000, 157000), ('AU', 4000, 184000), ('AU', 5000, 201000),
    ('FI', 2000,  99000), ('FI', 3000, 120000), ('FI', 4000, 140000), ('FI', 5000, 160000),
    ('MX', 2000, 102000), ('MX', 3000, 125000), ('MX', 4000, 148000), ('MX', 5000, 171000),
    ('ZW', 2000, 118000), ('ZW', 3000, 143000), ('ZW', 4000, 169000), ('ZW', 5000, 194000),
    ('ZA', 2000,  90000), ('ZA', 3000, 109000), ('ZA', 4000, 128000), ('ZA', 5000, 147000),
    ('US', 2000, 106000), ('US', 3000, 127000), ('US', 4000, 150000), ('US', 5000, 173000),
    ('CA', 2000, 106000), ('CA', 3000, 127000), ('CA', 4000, 150000), ('CA', 5000, 173000),
    ('GB', 2000,  92000), ('GB', 3000, 112000), ('GB', 4000, 131000), ('GB', 5000, 150000),
    ('NL', 2000,  98000), ('NL', 3000, 118000), ('NL', 4000, 138000), ('NL', 5000, 157000),
    ('FR', 1000,  78000), ('FR', 2500, 109000), ('FR', 3500, 129000),
    ('FR', 4500, 148000), ('FR', 5000, 158000)
),
-- Up to 5 kg: the narrowest published step that covers the band.
low as (
  select distinct on (p.country_code, b.id)
    p.country_code, b.id as bracket_id, p.price_naira
  from public.shipping_weight_brackets b
  join published p on p.upper_grams >= b.max_grams
  where b.max_grams <= 5000
  order by p.country_code, b.id, p.upper_grams
),
-- Above 5 kg: continue each country's own per-kilo progression.
high as (
  select
    c.country_code,
    b.id as bracket_id,
    (c.base_naira + (c.per_kg_naira * (b.max_grams - 5000)) / 1000)::int as price_naira
  from card c
  cross join public.shipping_weight_brackets b
  where b.max_grams > 5000
)
insert into public.shipping_rates (country_code, method_id, bracket_id, price, enabled)
select r.country_code, m.id, r.bracket_id, r.price_naira * 100, true
from (select * from low union all select * from high) r
cross join (select id from public.shipping_methods where code = 'ups-express') m;
