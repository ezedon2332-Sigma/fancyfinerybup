-- Fancy Finery — on-demand colour requests.
-- Customers can request a product in a colour that isn't listed yet.
-- All access is server-side via the service role (submit action validates;
-- admin reads/updates require admin), so RLS is enabled with no public policies
-- to keep customer PII private. Additive & safe.

create table if not exists public.color_requests (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references public.products (id) on delete set null,
  product_name    text not null,
  product_sku     text,
  requested_color text not null,
  requested_size  text,
  quantity        integer not null default 1 check (quantity > 0),
  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text,
  note            text,
  status          text not null default 'pending'
    check (status in ('pending', 'available', 'in_production', 'ready', 'completed', 'cancelled')),
  admin_note      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists color_requests_status_idx on public.color_requests (status);
create index if not exists color_requests_created_idx on public.color_requests (created_at desc);
create index if not exists color_requests_color_idx on public.color_requests (requested_color);
create index if not exists color_requests_product_idx on public.color_requests (product_id);

alter table public.color_requests enable row level security;
-- Intentionally no policies: only the service-role (server) client touches this
-- table, so customer contact details are never exposed to the public API.

drop trigger if exists color_requests_set_updated_at on public.color_requests;
create trigger color_requests_set_updated_at
  before update on public.color_requests
  for each row execute function public.set_updated_at();
