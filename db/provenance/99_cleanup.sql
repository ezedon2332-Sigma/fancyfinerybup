-- Strip every Supabase-ism from the applied schema, leaving only the 37 app
-- tables and the app's own triggers/functions. What survives this file is what
-- gets dumped as the committed baseline.

-- 1. Drop all RLS policies in public, then disable RLS. --------------------
-- The policies encode the security model; they do not disappear, they MOVE
-- into application code (repository adapters + the admin gate). Tracked as the
-- Phase 6 authorization audit in docs/MIGRATION_PLAN.md.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;

  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I disable row level security', r.tablename);
  end loop;
end $$;

-- 2. Drop the Supabase-coupled functions and their triggers. ---------------
-- is_admin() / guard_profile_role() read auth.uid(); handle_new_user() fires on
-- auth.users; email_exists() reads auth.users. All four are replaced in the app
-- layer (Better Auth hooks + the requireAdmin gate).
drop trigger  if exists profiles_guard_role on public.profiles;
drop function if exists public.guard_profile_role() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.email_exists(text) cascade;

-- 3. Remove the shimmed schemas. -------------------------------------------
-- CASCADE takes profiles' FK to auth.users with it; the FK to Better Auth's
-- user table is re-added in Phase 3, once those tables exist.
drop schema if exists auth    cascade;
drop schema if exists storage cascade;

-- 4. Remove Supabase's managed roles. --------------------------------------
drop owned by anon, authenticated, service_role;
drop role if exists anon;
drop role if exists authenticated;
drop role if exists service_role;
