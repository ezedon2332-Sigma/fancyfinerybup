-- Fancy Finery — published UPS rate card.
--
-- Replaces the seeded weight ladder and installs per-country UPS rates for
-- Australia, Finland, Mexico, Zimbabwe, South Africa, the USA, Canada, the
-- United Kingdom, the Netherlands and France.
--
-- TWO THINGS WORTH KNOWING BEFORE EDITING THIS FILE
--
-- 1. The published tariff reads with gaps ("0.5–2.0 kg", then "2.5–3.0 kg").
--    Carrier tariffs are contiguous — each row means "up to this weight" — so
--    a 2.2 kg parcel belongs in the 2.5–3.0 kg band, not in a hole. Bands are
--    therefore stored as contiguous half-open ranges: 0–2, 2–3, 3–4, 4–5.
--
-- 2. France steps at different weights (1.0, 2.5, 3.5, 4.5) from every other
--    country (2.0, 3.0, 4.0, 5.0). One shared ladder has to express both, so
--    it is cut at every boundary either shape uses and adjacent sub-bands
--    simply repeat the same price. That is why, say, 2–2.5 and 2.5–3 both
--    cost ₦157,000 in Australia: the tariff has one band there, the ladder
--    has two.
--
-- Every rate is a COUNTRY OVERRIDE, not a zone rate. Finland, the Netherlands
-- and France all sit in the European Union zone but price differently, so
-- zone rates cannot express this card.
--
-- Prices are NGN minor units (kobo): ₦129,000 is stored as 12_900_000.

-- 1) Rebuild the weight ladder ------------------------------------------------
-- Rates cascade from brackets, so clearing the ladder clears any rates hanging
-- off it. Safe today (the engine ships with none) and intentional: a rate
-- priced against a bracket that no longer exists would be a silent liability.
delete from public.shipping_rates;
delete from public.shipping_weight_brackets;

insert into public.shipping_weight_brackets (label, min_grams, max_grams, sort_order) values
  ('Up to 1 kg',   0,    1000, 10),
  ('1 – 2 kg',     1000, 2000, 20),
  ('2 – 2.5 kg',   2000, 2500, 30),
  ('2.5 – 3 kg',   2500, 3000, 40),
  ('3 – 3.5 kg',   3000, 3500, 50),
  ('3.5 – 4 kg',   3500, 4000, 60),
  ('4 – 4.5 kg',   4000, 4500, 70),
  ('4.5 – 5 kg',   4500, 5000, 80);
-- Deliberately no "over 5 kg" bracket: the published card stops at 5 kg, and
-- inventing a price would be worse than declining the parcel. Orders above
-- 5 kg get no UPS rate and fall through to the legacy per-country price.

-- 2) Make sure UPS Express exists and is the carrier for all of this ----------
insert into public.shipping_methods (code, name, description, min_days, max_days, sort_order)
values ('ups-express', 'UPS Express', 'Express worldwide delivery by UPS.', 1, 4, 10)
on conflict (code) do update
  set name = excluded.name, enabled = true;

-- 3) Country rates -------------------------------------------------------------
-- Written as (country, band-upper-bound, price) and expanded across every
-- ladder bracket that falls inside the band, so the source stays readable and
-- the repetition is generated rather than hand-typed.
with tariff(country_code, upper_grams, price_naira) as (
  values
    -- Australia
    ('AU', 2000, 129000), ('AU', 3000, 157000), ('AU', 4000, 184000), ('AU', 5000, 201000),
    -- Finland
    ('FI', 2000,  99000), ('FI', 3000, 120000), ('FI', 4000, 140000), ('FI', 5000, 160000),
    -- Mexico
    ('MX', 2000, 102000), ('MX', 3000, 125000), ('MX', 4000, 148000), ('MX', 5000, 171000),
    -- Zimbabwe
    ('ZW', 2000, 118000), ('ZW', 3000, 143000), ('ZW', 4000, 169000), ('ZW', 5000, 194000),
    -- South Africa
    ('ZA', 2000,  90000), ('ZA', 3000, 109000), ('ZA', 4000, 128000), ('ZA', 5000, 147000),
    -- United States
    ('US', 2000, 106000), ('US', 3000, 127000), ('US', 4000, 150000), ('US', 5000, 173000),
    -- Canada (same card as the USA)
    ('CA', 2000, 106000), ('CA', 3000, 127000), ('CA', 4000, 150000), ('CA', 5000, 173000),
    -- United Kingdom
    ('GB', 2000,  92000), ('GB', 3000, 112000), ('GB', 4000, 131000), ('GB', 5000, 150000),
    -- Netherlands
    ('NL', 2000,  98000), ('NL', 3000, 118000), ('NL', 4000, 138000), ('NL', 5000, 157000),
    -- France — steps at 1.0 / 2.5 / 3.5 / 4.5 / 5.0
    ('FR', 1000,  78000), ('FR', 2500, 109000), ('FR', 3500, 129000),
    ('FR', 4500, 148000), ('FR', 5000, 158000)
),
-- For each bracket take the NARROWEST tariff step that still covers it — the
-- first step whose upper bound reaches the bracket's own upper bound. Ordering
-- by upper_grams rather than by price keeps this correct even if a tariff is
-- ever published where a heavier band is cheaper.
resolved as (
  select distinct on (t.country_code, b.id)
    t.country_code,
    b.id as bracket_id,
    t.price_naira
  from public.shipping_weight_brackets b
  join tariff t
    on t.upper_grams >= coalesce(b.max_grams, b.min_grams)
  order by t.country_code, b.id, t.upper_grams
)
insert into public.shipping_rates (country_code, method_id, bracket_id, price, enabled)
select r.country_code, m.id, r.bracket_id, r.price_naira * 100, true
from resolved r
cross join (select id from public.shipping_methods where code = 'ups-express') m;
