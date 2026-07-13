-- Fancy Finery — Phase 1 seed data (safe to re-run).
-- Image `storage_path` values point at existing files in /public for now; once
-- real uploads land in the `product-images` bucket, replace them with bucket
-- paths. The Phase 2 image resolver handles both.

-- Categories -----------------------------------------------------------------
insert into public.categories (name, slug, description, sort_order) values
  ('Dresses',     'dresses',     'Refined day-to-evening dresses.',        1),
  ('Outerwear',   'outerwear',   'Statement coats and tailored jackets.',  2),
  ('Tops',        'tops',        'Blouses, shirts and knitwear.',          3),
  ('Accessories', 'accessories', 'Finishing touches for every look.',      4)
on conflict (slug) do nothing;

-- Products -------------------------------------------------------------------
insert into public.products (name, slug, description, price, currency, category_id, status, featured)
values
  ('Golden Hour Gown', 'golden-hour-gown',
   'A floor-length silk gown with a subtle gold sheen. Made for the spotlight.',
   45000000, 'NGN', (select id from public.categories where slug = 'dresses'), 'published', true),
  ('Midnight Tailored Coat', 'midnight-tailored-coat',
   'Structured wool-blend coat in deep black with a sharp lapel.',
   38000000, 'NGN', (select id from public.categories where slug = 'outerwear'), 'published', true),
  ('Ivory Silk Blouse', 'ivory-silk-blouse',
   'An effortless ivory blouse in pure silk. Understated luxury.',
   15000000, 'NGN', (select id from public.categories where slug = 'tops'), 'published', false),
  ('Amber Evening Dress', 'amber-evening-dress',
   'Fitted amber cocktail dress with a draped neckline.',
   29000000, 'NGN', (select id from public.categories where slug = 'dresses'), 'published', true),
  ('Noir Wrap Dress', 'noir-wrap-dress',
   'A timeless black wrap dress that moves with you.',
   22000000, 'NGN', (select id from public.categories where slug = 'dresses'), 'published', false),
  ('Draft — Spring Trench', 'draft-spring-trench',
   'Lightweight trench (not yet released — used to test draft visibility).',
   34000000, 'NGN', (select id from public.categories where slug = 'outerwear'), 'draft', false)
on conflict (slug) do nothing;

-- Product images -------------------------------------------------------------
insert into public.product_images (product_id, storage_path, alt, sort_order)
select p.id, v.storage_path, v.alt, v.sort_order
from (values
  ('golden-hour-gown',        'women.jpg',    'Golden Hour Gown',        0),
  ('midnight-tailored-coat',  'women2.jpeg',  'Midnight Tailored Coat',  0),
  ('ivory-silk-blouse',       'women3.jpeg',  'Ivory Silk Blouse',       0),
  ('amber-evening-dress',     'women4.jpeg',  'Amber Evening Dress',     0),
  ('noir-wrap-dress',         'women5.jpeg',  'Noir Wrap Dress',         0),
  ('draft-spring-trench',     'women6.jpeg',  'Spring Trench',           0)
) as v(slug, storage_path, alt, sort_order)
join public.products p on p.slug = v.slug
where not exists (
  select 1 from public.product_images pi where pi.product_id = p.id
);

-- Product variants (sizes) ---------------------------------------------------
insert into public.product_variants (product_id, size, color, sku, stock_qty)
select p.id, v.size, v.color, v.sku, v.stock_qty
from (values
  ('golden-hour-gown',       'S',  'Gold',  'FF-GHG-S',  5),
  ('golden-hour-gown',       'M',  'Gold',  'FF-GHG-M',  4),
  ('golden-hour-gown',       'L',  'Gold',  'FF-GHG-L',  2),
  ('midnight-tailored-coat', 'S',  'Black', 'FF-MTC-S',  3),
  ('midnight-tailored-coat', 'M',  'Black', 'FF-MTC-M',  6),
  ('ivory-silk-blouse',      'S',  'Ivory', 'FF-ISB-S',  8),
  ('ivory-silk-blouse',      'M',  'Ivory', 'FF-ISB-M',  8),
  ('amber-evening-dress',    'M',  'Amber', 'FF-AED-M',  4),
  ('amber-evening-dress',    'L',  'Amber', 'FF-AED-L',  3),
  ('noir-wrap-dress',        'S',  'Black', 'FF-NWD-S',  7),
  ('noir-wrap-dress',        'M',  'Black', 'FF-NWD-M',  5)
) as v(slug, size, color, sku, stock_qty)
join public.products p on p.slug = v.slug
on conflict (sku) do nothing;
