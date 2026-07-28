-- Fancy Finery — product reviews and ratings.
--
-- Moderated by default: a luxury storefront cannot have unvetted text appear
-- under its products, and `pending` is the safe initial state. Only `approved`
-- rows are ever read publicly.
--
-- Verified purchase is derived, not claimed. The order reference is resolved
-- server-side at submission, so the badge cannot be forged by the client.

create table if not exists public.product_reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  -- Reviews outlive accounts: keep the review, drop the link.
  profile_id    uuid references public.profiles (id) on delete set null,
  -- Snapshot, so a deleted account still shows "Adaeze O." rather than blank.
  author_name   text not null,
  rating        smallint not null check (rating between 1 and 5),
  title         text,
  body          text not null check (char_length(body) between 10 and 4000),
  -- Set server-side from a delivered order, never from the request.
  order_id      uuid references public.orders (id) on delete set null,
  verified      boolean not null default false,
  status        text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'spam')),
  -- Fit feedback, which is what shoppers of clothing actually want.
  fit_feedback  text check (fit_feedback is null or fit_feedback in ('small', 'true', 'large')),
  helpful_count integer not null default 0,
  admin_note    text,
  ip_hash       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One review per person per product. Partial, so the many rows with a null
-- profile (guest reviews) are not collapsed into one.
create unique index if not exists product_reviews_one_per_customer
  on public.product_reviews (product_id, profile_id)
  where profile_id is not null;

-- The public read: approved reviews for a product, newest first.
create index if not exists product_reviews_public_idx
  on public.product_reviews (product_id, created_at desc)
  where status = 'approved';
create index if not exists product_reviews_status_idx
  on public.product_reviews (status, created_at desc);
create index if not exists product_reviews_profile_idx
  on public.product_reviews (profile_id);
-- Rate limiting counts recent submissions per IP.
create index if not exists product_reviews_ip_recent_idx
  on public.product_reviews (ip_hash, created_at desc);

drop trigger if exists product_reviews_set_updated_at on public.product_reviews;
create trigger product_reviews_set_updated_at
  before update on public.product_reviews
  for each row execute function public.set_updated_at();

-- Denormalised aggregates on the product.
--
-- Products are listed far more often than reviewed, and a collection page
-- showing stars on twenty cards would otherwise mean twenty aggregate queries.
-- A trigger keeps these exact, so the read is a column.
alter table public.products
  add column if not exists rating_sum   integer not null default 0,
  add column if not exists rating_count integer not null default 0;

create or replace function public.recount_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  -- Recomputed from the table rather than incremented, so it is self-healing:
  -- a moderation change, an edit or a delete all land correctly, and any drift
  -- is corrected on the next write.
  update public.products p
     set rating_sum = coalesce(agg.total, 0),
         rating_count = coalesce(agg.n, 0)
    from (
      select sum(rating)::int as total, count(*)::int as n
        from public.product_reviews
       where product_id = target and status = 'approved'
    ) agg
   where p.id = target;
  return null;
end;
$$;

drop trigger if exists product_reviews_recount on public.product_reviews;
create trigger product_reviews_recount
  after insert or update or delete on public.product_reviews
  for each row execute function public.recount_product_rating();

-- Backfill for any rows that predate the trigger.
update public.products p
   set rating_sum = coalesce(agg.total, 0),
       rating_count = coalesce(agg.n, 0)
  from (
    select product_id, sum(rating)::int as total, count(*)::int as n
      from public.product_reviews
     where status = 'approved'
     group by product_id
  ) agg
 where p.id = agg.product_id;

-- RLS on, no policies: reads and writes both go through server code that
-- filters to `approved` and validates input.
alter table public.product_reviews enable row level security;
