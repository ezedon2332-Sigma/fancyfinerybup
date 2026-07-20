-- Fancy Finery — seed shipping_countries with major destinations.
-- Prices are NGN minor units (kobo): e.g. 500000 = ₦5,000. free_over/express_price
-- may be NULL. Zones must match the app's ShippingZone values. Safe to re-run.

insert into public.shipping_countries
  (code, name, zone, enabled, standard_price, standard_min_days, standard_max_days,
   express_price, express_min_days, express_max_days, free_over)
values
  -- Africa — Nigeria is domestic (cheapest, fast, free over ₦200,000)
  ('NG', 'Nigeria',              'Africa', true,  200000, 2,  4,   500000, 1, 2, 20000000),
  ('GH', 'Ghana',                'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('KE', 'Kenya',                'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('ZA', 'South Africa',         'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('EG', 'Egypt',                'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('MA', 'Morocco',              'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('TZ', 'Tanzania',             'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('UG', 'Uganda',               'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('RW', 'Rwanda',               'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('SN', 'Senegal',              'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('CI', 'Côte d''Ivoire',       'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('CM', 'Cameroon',             'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('ET', 'Ethiopia',             'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),
  ('DZ', 'Algeria',              'Africa', true,  500000, 4,  9,  1200000, 2, 4, NULL),

  -- Europe
  ('GB', 'United Kingdom',       'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('DE', 'Germany',              'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('FR', 'France',               'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('IT', 'Italy',                'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('ES', 'Spain',                'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('NL', 'Netherlands',          'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('IE', 'Ireland',              'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('BE', 'Belgium',              'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('SE', 'Sweden',               'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('CH', 'Switzerland',          'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('PT', 'Portugal',             'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('PL', 'Poland',               'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('NO', 'Norway',               'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('DK', 'Denmark',              'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),
  ('AT', 'Austria',              'Europe', true, 1500000, 6, 12,  3000000, 3, 6, NULL),

  -- Asia / Middle East
  ('AE', 'United Arab Emirates', 'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('CN', 'China',                'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('JP', 'Japan',                'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('IN', 'India',                'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('SG', 'Singapore',            'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('SA', 'Saudi Arabia',         'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('KR', 'Korea (South)',        'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('HK', 'Hong Kong',            'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('MY', 'Malaysia',             'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('QA', 'Qatar',                'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('TR', 'Türkiye',              'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('ID', 'Indonesia',            'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('PH', 'Philippines',          'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),
  ('TH', 'Thailand',             'Asia',   true, 1600000, 6, 12,  3200000, 3, 6, NULL),

  -- North America
  ('US', 'United States',        'North America', true, 1800000, 6, 12, 3500000, 3, 6, NULL),
  ('CA', 'Canada',               'North America', true, 1800000, 6, 12, 3500000, 3, 6, NULL),
  ('MX', 'Mexico',               'North America', true, 1800000, 6, 12, 3500000, 3, 6, NULL),
  ('JM', 'Jamaica',              'North America', true, 1800000, 6, 12, 3500000, 3, 6, NULL),
  ('TT', 'Trinidad and Tobago',  'North America', true, 1800000, 6, 12, 3500000, 3, 6, NULL),

  -- South America
  ('BR', 'Brazil',               'South America', true, 2000000, 9, 16, 4000000, 5, 8, NULL),
  ('AR', 'Argentina',            'South America', true, 2000000, 9, 16, 4000000, 5, 8, NULL),
  ('CL', 'Chile',                'South America', true, 2000000, 9, 16, 4000000, 5, 8, NULL),
  ('CO', 'Colombia',             'South America', true, 2000000, 9, 16, 4000000, 5, 8, NULL),
  ('PE', 'Peru',                 'South America', true, 2000000, 9, 16, 4000000, 5, 8, NULL),

  -- Oceania
  ('AU', 'Australia',            'Oceania', true, 2000000, 9, 16, 4000000, 5, 8, NULL),
  ('NZ', 'New Zealand',          'Oceania', true, 2000000, 9, 16, 4000000, 5, 8, NULL)
on conflict (code) do nothing;

-- Ensure the exchange-rate settings row exists (NGN per USD).
insert into public.shipping_settings (id) values (true) on conflict (id) do nothing;
