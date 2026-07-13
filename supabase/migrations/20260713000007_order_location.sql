-- Fancy Finery — capture delivery location on orders (device geolocation).
alter table public.orders
  add column if not exists shipping_lat double precision,
  add column if not exists shipping_lng double precision;
