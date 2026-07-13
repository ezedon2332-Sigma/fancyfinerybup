-- Fancy Finery — saved delivery address/location on the customer profile.
alter table public.profiles
  add column if not exists phone   text,
  add column if not exists address text,
  add column if not exists city    text,
  add column if not exists state   text,
  add column if not exists country text,
  add column if not exists lat     double precision,
  add column if not exists lng     double precision;
