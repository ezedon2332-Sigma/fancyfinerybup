-- Fancy Finery — admin allowlist.
-- Emails here are auto-promoted to admin on signup (and existing matching users
-- are promoted immediately). No admin self-service.

create table if not exists public.admin_allowlist (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;
-- No policies: only SECURITY DEFINER functions / the secret key may touch it.

insert into public.admin_allowlist (email) values ('ezedon2332@gmail.com')
on conflict (email) do nothing;

-- Fix the role-escalation guard so trusted system contexts (SECURITY DEFINER
-- triggers, service key, direct DB connections) — where auth.uid() is null —
-- may set roles. Regular users always have a non-null auth.uid().
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change a profile role';
  end if;
  return new;
end;
$$;

-- Recreate the signup trigger fn to promote allowlisted emails.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_allow boolean;
begin
  select exists (
    select 1 from public.admin_allowlist a
    where lower(a.email) = lower(new.email)
  ) into is_allow;

  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    case when is_allow then 'admin'::public.user_role else 'customer'::public.user_role end
  )
  on conflict (id) do update
    set role = case when is_allow then 'admin'::public.user_role else public.profiles.role end;

  return new;
end;
$$;

-- Promote any existing users whose email is allowlisted.
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and lower(u.email) in (select lower(email) from public.admin_allowlist);
