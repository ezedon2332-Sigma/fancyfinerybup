-- Fancy Finery — Nigeria local delivery.
--
-- A flat fee per named destination, chosen by the customer, rather than the
-- weight brackets the international engine uses. The two are deliberately
-- separate: nothing in here touches `shipping_zones`, `shipping_rates` or the
-- courier tables, so a change to Lagos pricing cannot move a parcel to Berlin.
--
-- Scale is the point of the two-table shape. Adding Kano with forty areas is
-- rows, not code — the admin screen writes here and checkout reads from here,
-- with no deploy in between.

-- states ---------------------------------------------------------------------
create table if not exists public.ng_states (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- Optional short code (LA, FC). Not a key: states are referenced by id.
  code       text,
  sort_order integer not null default 0,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

-- Case-insensitive, so "Lagos" cannot be added twice as "lagos".
create unique index if not exists ng_states_name_key
  on public.ng_states (lower(name));

-- destinations ---------------------------------------------------------------
create table if not exists public.ng_destinations (
  id         uuid primary key default gen_random_uuid(),
  state_id   uuid not null references public.ng_states (id) on delete cascade,
  name       text not null,
  -- Kobo, like every other money column in this schema. Integer so no amount
  -- can arrive as 4499.999999.
  price_kobo integer not null check (price_kobo >= 0),
  enabled    boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ng_destinations_state_name_key
  on public.ng_destinations (state_id, lower(name));

-- The only query checkout makes: enabled destinations for one state.
create index if not exists ng_destinations_state_idx
  on public.ng_destinations (state_id, enabled, sort_order, name);

-- Server-only, like the rest of the pricing tables: RLS on with no policies, so
-- nothing is reachable except through the service-role client.
alter table public.ng_states       enable row level security;
alter table public.ng_destinations enable row level security;

-- seed: the 36 states and the Federal Capital Territory ----------------------
insert into public.ng_states (name, code, sort_order)
values
  ('Abia', 'AB', 10), ('Adamawa', 'AD', 20), ('Akwa Ibom', 'AK', 30),
  ('Anambra', 'AN', 40), ('Bauchi', 'BA', 50), ('Bayelsa', 'BY', 60),
  ('Benue', 'BE', 70), ('Borno', 'BO', 80), ('Cross River', 'CR', 90),
  ('Delta', 'DE', 100), ('Ebonyi', 'EB', 110), ('Edo', 'ED', 120),
  ('Ekiti', 'EK', 130), ('Enugu', 'EN', 140),
  ('Federal Capital Territory', 'FC', 150), ('Gombe', 'GO', 160),
  ('Imo', 'IM', 170), ('Jigawa', 'JI', 180), ('Kaduna', 'KD', 190),
  ('Kano', 'KN', 200), ('Katsina', 'KT', 210), ('Kebbi', 'KE', 220),
  ('Kogi', 'KO', 230), ('Kwara', 'KW', 240), ('Lagos', 'LA', 250),
  ('Nasarawa', 'NA', 260), ('Niger', 'NI', 270), ('Ogun', 'OG', 280),
  ('Ondo', 'ON', 290), ('Osun', 'OS', 300), ('Oyo', 'OY', 310),
  ('Plateau', 'PL', 320), ('Rivers', 'RI', 330), ('Sokoto', 'SO', 340),
  ('Taraba', 'TA', 350), ('Yobe', 'YO', 360), ('Zamfara', 'ZA', 370)
on conflict do nothing;

-- seed: Lagos delivery areas --------------------------------------------------
-- Prices exactly as supplied by the house, in kobo.
insert into public.ng_destinations (state_id, name, price_kobo, sort_order)
select s.id, d.name, d.price_kobo, d.sort_order
  from public.ng_states s
  join (values
    ('Lekki',          450000, 10),
    ('Surulere',       350000, 20),
    ('Yaba',           350000, 30),
    ('Bagada',         450000, 40),
    ('Ikeja',          450000, 50),
    ('Ogba',           450000, 60),
    ('Magodo',         450000, 70),
    ('Lagos Mainland', 450000, 80),
    ('Obanikoro',      450000, 90),
    ('Fadeyi',         350000, 100),
    ('Anthony',        350000, 110),
    ('Festac',         550000, 120),
    ('Agbara',         550000, 130),
    ('Egbeda',         500000, 140),
    ('Iyana-Paja',     500000, 150),
    ('Agege',          500000, 160),
    ('Abule Egba',     550000, 170)
  ) as d(name, price_kobo, sort_order) on true
 where lower(s.name) = 'lagos'
on conflict do nothing;

-- Keeps `updated_at` honest without the application having to remember.
create or replace function public.touch_ng_destination()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ng_destinations_touch on public.ng_destinations;
create trigger ng_destinations_touch
  before update on public.ng_destinations
  for each row execute function public.touch_ng_destination();
