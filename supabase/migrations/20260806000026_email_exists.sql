-- Fancy Finery — identity-first auth: does an email already have an account?
--
-- SECURITY DEFINER so it can read auth.users, with a locked search_path. Execute
-- is REVOKED from public/anon/authenticated and granted only to service_role, so
-- the boolean is reachable exclusively from trusted server code (a rate-limited
-- server action) — never directly from the browser. This is used only to route
-- the UX (login vs. create-account); it never exposes more than the signup flow
-- already does when it says "an account already exists for that email".

create or replace function public.email_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users
     where lower(email) = lower(trim(p_email))
  );
$$;

revoke execute on function public.email_exists(text) from public;
revoke execute on function public.email_exists(text) from anon;
revoke execute on function public.email_exists(text) from authenticated;
grant execute on function public.email_exists(text) to service_role;
