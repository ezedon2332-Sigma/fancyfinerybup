-- Fancy Finery — master colour list for the "Request a Colour" dialog.
-- Public-read (the dialog loads active colours), admin-write. Safe to re-run.

create table if not exists public.colors (
  id         uuid primary key default gen_random_uuid(),
  color_name text not null unique,
  color_code text,
  active      boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists colors_active_idx on public.colors (active);

alter table public.colors enable row level security;
drop policy if exists colors_public_read on public.colors;
create policy colors_public_read on public.colors for select using (true);
drop policy if exists colors_admin_write on public.colors;
create policy colors_admin_write on public.colors
  for all using (public.is_admin()) with check (public.is_admin());

-- Standard fashion colours.
insert into public.colors (color_name, color_code) values
  ('Black',        '#111111'),
  ('White',        '#f5f5f0'),
  ('Ivory',        '#fffff0'),
  ('Cream',        '#f3ead6'),
  ('Beige',        '#d8c3a5'),
  ('Tan',          '#d2b48c'),
  ('Camel',        '#c19a6b'),
  ('Brown',        '#6b4a2b'),
  ('Chocolate',    '#3f2a1d'),
  ('Grey',         '#6b7280'),
  ('Charcoal',     '#36393f'),
  ('Silver',       '#c0c0c0'),
  ('Navy Blue',    '#1e293b'),
  ('Royal Blue',   '#1d4ed8'),
  ('Sky Blue',     '#38bdf8'),
  ('Teal',         '#0d9488'),
  ('Turquoise',    '#14b8a6'),
  ('Green',        '#16a34a'),
  ('Emerald Green','#059669'),
  ('Olive',        '#556b2f'),
  ('Mint',         '#a7f3d0'),
  ('Yellow',       '#eab308'),
  ('Mustard',      '#c9a227'),
  ('Gold',         '#d4af37'),
  ('Orange',       '#ea580c'),
  ('Coral',        '#ff7f50'),
  ('Peach',        '#ffcba4'),
  ('Pink',         '#ec4899'),
  ('Hot Pink',     '#ff1493'),
  ('Fuchsia',      '#d946ef'),
  ('Rose Gold',    '#b76e79'),
  ('Red',          '#b91c1c'),
  ('Wine',         '#722f37'),
  ('Burgundy',     '#800020'),
  ('Maroon',       '#5a1a2b'),
  ('Purple',       '#7c3aed'),
  ('Lavender',     '#b57edc'),
  ('Lilac',        '#c8a2c8'),
  ('Khaki',        '#8f9779'),
  ('Denim',        '#3b5b92'),
  ('Multicolour',  '#9ca3af')
on conflict (color_name) do nothing;
