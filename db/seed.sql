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
   34000000, 'NGN', (select id from public.categories where slug = 'outerwear'), 'draft', false),
  ('Ivory Bubble-Hem Mini Dress', 'ivory-bubble-hem-mini-dress',
   'A sculptural ivory mini in structured satin, finished with a signature bubble hem and long fitted sleeves.',
   26000000, 'NGN', (select id from public.categories where slug = 'dresses'), 'published', true),
  ('Tangerine Bubble Mini Dress', 'tangerine-bubble-mini-dress',
   'A vivid tangerine mini with a sleeveless high neck and tiered bubble volume — made to be noticed.',
   24000000, 'NGN', (select id from public.categories where slug = 'dresses'), 'published', true),
  ('Pearl Puff Cocktail Dress', 'pearl-puff-cocktail-dress',
   'An ivory cocktail mini with a voluminous puff-ball skirt and long sleeves — quietly dramatic.',
   28000000, 'NGN', (select id from public.categories where slug = 'dresses'), 'published', false)
on conflict (slug) do nothing;

-- Product images -------------------------------------------------------------
insert into public.product_images (product_id, storage_path, alt, sort_order)
select p.id, v.storage_path, v.alt, v.sort_order
from (values
  ('golden-hour-gown',        'women.jpg',    'Golden Hour Gown',        0),
  ('midnight-tailored-coat',  'women2.jpeg',  'Midnight Tailored Coat',  0),
  ('ivory-silk-blouse',       'women3.jpeg',  'Ivory Silk Blouse',       0),
  ('amber-evening-dress',     'women4.jpeg',  'Amber Evening Dress',     0),
  ('noir-wrap-dress',            'women5.jpeg',  'Noir Wrap Dress',            0),
  ('draft-spring-trench',        'women6.jpeg',  'Spring Trench',              0),
  ('ivory-bubble-hem-mini-dress','women7.jpeg',  'Ivory Bubble-Hem Mini Dress',0),
  ('tangerine-bubble-mini-dress','women8.jpeg',  'Tangerine Bubble Mini Dress',0),
  ('pearl-puff-cocktail-dress',  'women9.jpeg',  'Pearl Puff Cocktail Dress',  0)
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
  ('noir-wrap-dress',        'S',  'Black',     'FF-NWD-S',  7),
  ('noir-wrap-dress',        'M',  'Black',     'FF-NWD-M',  5),
  ('ivory-bubble-hem-mini-dress', 'S', 'Ivory',     'FF-IBH-S', 6),
  ('ivory-bubble-hem-mini-dress', 'M', 'Ivory',     'FF-IBH-M', 5),
  ('ivory-bubble-hem-mini-dress', 'L', 'Ivory',     'FF-IBH-L', 3),
  ('tangerine-bubble-mini-dress', 'S', 'Tangerine', 'FF-TBM-S', 5),
  ('tangerine-bubble-mini-dress', 'M', 'Tangerine', 'FF-TBM-M', 5),
  ('tangerine-bubble-mini-dress', 'L', 'Tangerine', 'FF-TBM-L', 2),
  ('pearl-puff-cocktail-dress',   'S', 'Ivory',     'FF-PPC-S', 4),
  ('pearl-puff-cocktail-dress',   'M', 'Ivory',     'FF-PPC-M', 4)
) as v(slug, size, color, sku, stock_qty)
join public.products p on p.slug = v.slug
on conflict (sku) do nothing;

-- ---------------------------------------------------------------------------
-- DEV FIXTURE: the Women / Men / Children collections.
--
-- The navbar dropdown and the homepage promo cards are driven entirely by the
-- categories table — nothing about them is hardcoded any more — so with no
-- rows here those surfaces correctly render nothing. This gives a dev database
-- something to show.
--
-- Only ever applied by `npm run db:seed`, which is not part of the production
-- deploy path. On a real store an admin creates these in Admin -> Collections
-- and the same code renders them.
--
-- The existing dresses/outerwear/tops/accessories categories are left alone so
-- the footer links that point at them keep working.
-- ---------------------------------------------------------------------------

insert into public.categories (name, slug, description, sort_order) values
  ('Women',    'women',    'Elegant designs for every occasion.',        1),
  ('Men',      'men',      'Sophisticated styles for the modern man.',   2),
  ('Children', 'children', 'Premium fashion for the little ones.',       3)
on conflict (slug) do update
  set description = excluded.description,
      sort_order  = excluded.sort_order;

-- Push the original product-type categories behind the three collections. The
-- homepage promo strip and the footer both show the first few by sort_order, so
-- this is how an admin decides what leads — no separate "featured" flag needed.
update public.categories set sort_order = 10 where slug = 'dresses';
update public.categories set sort_order = 11 where slug = 'outerwear';
update public.categories set sort_order = 12 where slug = 'tops';
update public.categories set sort_order = 13 where slug = 'accessories';

insert into public.products (name, slug, description, price, currency, category_id, status, featured)
values
  ('Aurelia Silk Slip', 'aurelia-silk-slip',
   'A bias-cut silk slip that skims rather than clings. Evening, effortless.',
   32000000, 'NGN', (select id from public.categories where slug = 'women'), 'published', true),
  ('Rose Quartz Wrap Blouse', 'rose-quartz-wrap-blouse',
   'A softly draped wrap blouse in a dusted rose. Day to dinner.',
   18500000, 'NGN', (select id from public.categories where slug = 'women'), 'published', false),
  ('Onyx Tailored Two-Piece', 'onyx-tailored-two-piece',
   'Sharp-shouldered jacket and straight trouser in a deep matte black.',
   52000000, 'NGN', (select id from public.categories where slug = 'men'), 'published', true),
  ('Sable Merino Roll-Neck', 'sable-merino-roll-neck',
   'Fine-gauge merino in a warm sable. Quiet luxury, worn every week.',
   21000000, 'NGN', (select id from public.categories where slug = 'men'), 'published', false),
  ('Petal Occasion Dress', 'petal-occasion-dress',
   'A twirl-ready occasion dress with a soft tulle underskirt. Ages 4-10.',
   12500000, 'NGN', (select id from public.categories where slug = 'children'), 'published', true),
  ('Little Explorer Knit Set', 'little-explorer-knit-set',
   'A two-piece cotton knit set built for playgrounds and photographs alike.',
   9500000, 'NGN', (select id from public.categories where slug = 'children'), 'published', false)
on conflict (slug) do nothing;

-- Imagery: the repository only ships womenswear photography, so the men's and
-- children's pieces intentionally carry none. That is the honest state, and it
-- also exercises the no-image path in the promo cards and product grid.
insert into public.product_images (product_id, storage_path, alt, sort_order)
select p.id, v.path, p.name, 0
from (values
  ('aurelia-silk-slip',        'women3.jpeg'),
  ('rose-quartz-wrap-blouse',  'women7.jpeg')
) as v(slug, path)
join public.products p on p.slug = v.slug
where not exists (
  select 1 from public.product_images pi where pi.product_id = p.id
);

insert into public.product_variants (product_id, size, color, sku, stock_qty)
select p.id, s.size, s.color, p.slug || '-' || lower(s.size), s.qty
from (values
  ('S', 'As pictured', 6),
  ('M', 'As pictured', 8),
  ('L', 'As pictured', 4)
) as s(size, color, qty)
cross join public.products p
where p.slug in (
  'aurelia-silk-slip', 'rose-quartz-wrap-blouse', 'onyx-tailored-two-piece',
  'sable-merino-roll-neck', 'petal-occasion-dress', 'little-explorer-knit-set'
)
and not exists (
  select 1 from public.product_variants pv where pv.product_id = p.id
);

-- ---------------------------------------------------------------------------
-- DEV FIXTURE: put a few pieces in the Lookbook.
--
-- The Lookbook is an editorial edit, not the catalogue, so membership is an
-- explicit admin choice: Admin -> Products -> "Show in Lookbook". A product
-- appears only when ALL THREE hold (see infrastructure/db/lookbook-service.ts):
--
--   1. lookbook = true          the admin's decision
--   2. status   = 'published'   never leak a draft onto a public page
--   3. has a still image        the panels are full-bleed <Image>; a video-only
--                               product would render a broken frame
--
-- Nothing here is special: it just ticks box 1 on six pieces that already
-- satisfy 2 and 3, so a dev database has a Lookbook to look at.
-- ---------------------------------------------------------------------------

update public.products
set lookbook = true
where slug in (
  'golden-hour-gown',
  'midnight-tailored-coat',
  'amber-evening-dress',
  'noir-wrap-dress',
  'aurelia-silk-slip',
  'rose-quartz-wrap-blouse'
);
