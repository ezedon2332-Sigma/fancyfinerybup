-- Compat shims so the 28 Supabase migrations apply UNMODIFIED to plain
-- Postgres. Everything created here is destroyed by 99_cleanup.sql; none of it
-- reaches the committed baseline. Its only job is fidelity: we want the exact
-- schema those migrations produce, not a hand-retyped approximation of it.

-- Supabase's managed roles.
do $$ begin create role anon;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role;  exception when duplicate_object then null; end $$;

-- auth schema — only the surface the migrations actually touch.
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb
);

-- Under Supabase this reads the request JWT. Nothing here signs in, so NULL is
-- the honest answer, and it is also what the migrations' own comments describe
-- as the "trusted system context" case.
create or replace function auth.uid() returns uuid language sql stable as $$
  select null::uuid;
$$;

-- storage schema — the product-images bucket migration writes to these.
create schema if not exists storage;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text
);

alter table storage.objects enable row level security;
