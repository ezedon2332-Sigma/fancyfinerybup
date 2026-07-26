-- Fancy Finery — extend the UPS rate card from 5 kg to 20 kg+.
--
-- Published rates up to 5 kg are left EXACTLY as they are. This adds 1 kg
-- bands from 5–6 kg through 19–20 kg, plus an open-ended 20 kg+ band.
--
-- HOW THE EXTENDED PRICES ARE DERIVED
--
-- Each country's published bands already imply a per-kilo rate. Taking the
-- span from the 2 kg price to the 5 kg price and dividing by 3 kg gives:
--
--     AU 24.00   FI 20.33   MX 23.00   ZW 25.33   ZA 19.00
--     US 22.33   GB 19.33   NL 19.67   FR 20.00 (over its own 1–5 kg span)
--
-- Rounded to the nearest ₦1,000 those become the per-kilo rates below, which
-- keeps every extended price a round thousand and every step uniform.
--
-- Australia is the one judgement call. Its deltas run 28 / 27 / 17 — the final
-- step tapers. Continuing at 17/kg would visibly break the curve the first
-- three bands establish, so the 24/kg average is used instead.
--
--     price(W kg) = price(5 kg) + per_kg × (W − 5)
--
-- Prices are NGN minor units (kobo).

-- 1) Extra weight brackets: 5–6 … 19–20, then open-ended 20 kg+ --------------
insert into public.shipping_weight_brackets (label, min_grams, max_grams, sort_order)
select
  format('%s – %s kg', w.kg, w.kg + 1),
  w.kg * 1000,
  (w.kg + 1) * 1000,
  100 + w.kg
from generate_series(5, 19) as w(kg)
on conflict (min_grams) do nothing;

insert into public.shipping_weight_brackets (label, min_grams, max_grams, sort_order)
values ('20 kg +', 20000, null, 200)
on conflict (min_grams) do nothing;

-- 2) Rates for the new bands ---------------------------------------------------
with rate_card(country_code, base_naira, per_kg_naira) as (
  values
    ('AU', 201000, 24000),
    ('FI', 160000, 20000),
    ('MX', 171000, 23000),
    ('ZW', 194000, 25000),
    ('ZA', 147000, 19000),
    ('US', 173000, 22000),
    ('CA', 173000, 22000),
    ('GB', 150000, 19000),
    ('NL', 157000, 20000),
    ('FR', 158000, 20000)
),
-- Bounded bands are priced at their upper edge; the open-ended 20 kg+ band
-- takes one further step, continuing the same progression past the table.
priced as (
  select
    c.country_code,
    b.id as bracket_id,
    c.base_naira + c.per_kg_naira * (
      coalesce(b.max_grams / 1000, (b.min_grams / 1000) + 1) - 5
    ) as price_naira
  from rate_card c
  cross join public.shipping_weight_brackets b
  where b.min_grams >= 5000
)
insert into public.shipping_rates (country_code, method_id, bracket_id, price, enabled)
select p.country_code, m.id, p.bracket_id, p.price_naira * 100, true
from priced p
cross join (select id from public.shipping_methods where code = 'ups-express') m
on conflict do nothing;
